const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
require("dotenv").config();

const app = express();
const PORT = 9000;

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

app.post("/project", async (req, res) => {
  const { gitURL, slug } = req.body;
  const projectSlug = slug ? slug : generateSlug();

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
          name: "builder-image",
          environment: [
            { name: "GIT_REPOSITORY__URL", value: gitURL },
            { name: "PROJECT_ID", value: projectSlug },
            { name: "S3_ACCESS_KEY_ID", value: process.env.S3_ACCESS_KEY_ID },
            {
              name: "S3_SECRET_ACCESS_KEY",
              value: process.env.S3_SECRET_ACCESS_KEY,
            },
            { name: "S3_BUCKET_NAME", value: process.env.S3_BUCKET_NAME },
            { name: "S3_REGION", value: process.env.S3_REGION },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: "queued",
    data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  });
});

app.listen(PORT, () => console.log(`API Server Running..${PORT}`));
