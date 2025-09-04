const express = require("express");
require("dotenv").config();
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@clickhouse/client");
const { Kafka } = require("kafkajs");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 9000;

const prisma = new PrismaClient({});
const io = new Server({ cors: "*" });

const kafka = new Kafka({
  clientId: `api-server`,
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")],
  },
  sasl: {
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    mechanism: "plain",
  },
});

const client = createClient({
  host: process.env.CLICKHOUSE_HOST,
  database: "default",
  username: process.env.CLICKHOUSE_USERNAME,
  password: process.env.CLICKHOUSE_PASSWORD,
});

const consumer = kafka.consumer({ groupId: "api-server-logs-consumer" });

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

io.listen(9002, () => console.log("Socket Server 9002"));

const ecsClient = new ECSClient({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const config = {
  CLUSTER: process.env.CLUSTER_ARN,
  TASK: process.env.TASK_ARN,
};

app.use(express.json());
app.use(cors());

app.post("/project", async (req, res) => {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string(),
  });
  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) {
    return res.status(400).json({ error: safeParseResult.error });
  }
  const { name, gitURL } = safeParseResult.data;

  const project = await prisma.project.create({
    data: { name, gitURL, subDomain: generateSlug() },
  });

  return res.json({ status: "success", data: { project } });
});

app.post("/deploy", async (req, res) => {
  const schema = z.object({
    projectId: z.string(),
  });

  const safeParseResult = schema.safeParse(req.body);
  if (!safeParseResult.success) {
    return res.status(400).json({ error: safeParseResult.error });
  }

  const { projectId } = safeParseResult.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const activeDeployment = await prisma.deployment.findFirst({
      where: {
        projectId: project.id,
        status: { in: ["QUEUED", "IN_PROGRESS"] },
      },
    });
    if (activeDeployment) {
      return res.status(400).json({
        error: "There is already an active deployment for this project",
      });
    }

    const deployment = await prisma.deployment.create({
      data: { project: { connect: { id: projectId } }, status: "QUEUED" },
    });

    // Spin the container
    const command = new RunTaskCommand({
      cluster: config.CLUSTER,
      taskDefinition: config.TASK,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: [
            process.env.SUBNET_1,
            process.env.SUBNET_2,
            process.env.SUBNET_3,
          ],
          securityGroups: [process.env.SECURITY_GROUP],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "build-image-task",
            environment: [
              { name: "GIT_REPOSITORY__URL", value: project.gitURL },
              { name: "PROJECT_ID", value: projectId },
              { name: "DEPLOYMENT_ID", value: deployment.id },
              { name: "S3_ACCESS_KEY_ID", value: process.env.S3_ACCESS_KEY_ID },
              {
                name: "S3_SECRET_ACCESS_KEY",
                value: process.env.S3_SECRET_ACCESS_KEY,
              },
              { name: "S3_BUCKET_NAME", value: process.env.S3_BUCKET_NAME },
              { name: "S3_REGION", value: process.env.S3_REGION },
              { name: "SERVICE_URI", value: process.env.SERVICE_URI },
              { name: "KAFKA_BROKER", value: process.env.KAFKA_BROKER },
              { name: "KAFKA_USERNAME", value: process.env.KAFKA_USERNAME },
              { name: "KAFKA_PASSWORD", value: process.env.KAFKA_PASSWORD },
              { name: "CLICKHOUSE_HOST", value: process.env.CLICKHOUSE_URI },
              {
                name: "CLICKHOUSE_USERNAME",
                value: process.env.CLICKHOUSE_USERNAME,
              },
              {
                name: "CLICKHOUSE_PASSWORD",
                value: process.env.CLICKHOUSE_PASSWORD,
              },
            ],
          },
        ],
      },
    });

    await ecsClient.send(command);

    return res.json({
      status: "queued",
      data: { deploymentId: deployment.id },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/logs/:id", async function (req, res) {
  const { id } = req.params;
  const logs = await client.query({
    query: `SELECT event_id, deployment_id, log, timestamp FROM log_events WHERE deployment_id={deployment_id:String} ORDER BY timestamp DESC`,
    query_params: { deployment_id: id },
    format: "JSONEachRow",
  });
  return res.json({ status: "success", data: { logs: await logs.json() } });
});
async function initkafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["container-logs"] });
  await consumer.run({
    autoCommit: false,
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages;
      console.log("Received batch of messages", messages.length);

      for (const message of messages) {
        const stringMessage = message.value.toString();
        const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(stringMessage);
        console.log(
          `Log for Project: ${PROJECT_ID} Deployment: ${DEPLOYMENT_ID}`
        );
        io.to(DEPLOYMENT_ID).emit("message", log);

        try {
          const { query_id } = await client.insert({
            table: "log_events",
            values: [{ event_id: uuidv4(), deployment_id: DEPLOYMENT_ID, log }],
            format: "JSONEachRow",
          });
          console.log("Inserted log into ClickHouse with query id:", query_id);
          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (err) {
          console.log("Error inserting log into ClickHouse:", err);
        }
      }
    },
  });
}

initkafkaConsumer();

app.listen(PORT, () => console.log(`API Server Running..${PORT}`));
