# 🚀 GithubRepo-DeploymentApp

A lightweight deployment system inspired by **Vercel**, built with **Node.js, AWS ECS, S3, ECR, Docker, Prisma, Kafka, Clickhouse, Postgres**.  
This project allows users to provide a **GitHub repository URL**, which is then cloned, built, and deployed seamlessly to AWS S3.  
Users can access their deployed application through a proxy server, while build logs are streamed live in real-time.

---

## ✨ Features
- 🌐 Deploy applications directly from GitHub URLs.
- 📦 Dockerized builder image for consistent builds.
- ☁️ Integration with **AWS ECS, ECR, and S3** for scalable deployments.
- 🔗 Real-time log streaming via **kafka and clickhouse**.
- ⚡ API server to manage deployments and trigger tasks.
- 🖥️ Proxy server for serving deployed projects directly from S3.

---

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js, Kafka
- **Containerization:** Docker, AWS ECR
- **Orchestration:** AWS ECS (Fargate)
- **Storage:** AWS S3
- **Messaging:** kafka
- **Database:** Postgres, clickhouse
- **Other:** GitHub integration, child processes for builds

---

## 📂 Project Workflow
1. User submits a **GitHub repository URL**.
2. API server triggers an **ECS Task** using a pre-built Docker image from **ECR**.
3. The container:
   - Clones the repo.
   - Installs dependencies & runs build.
   - Uploads build artifacts (e.g., `dist/`) to **AWS S3**.
4. Proxy server serves files directly from S3.
5. Build logs are published to **kafka**, and then stored in real time in **clickhouse**

---


graph TD
    subgraph User Interaction
        User[👨‍💻 User]
    end

    subgraph API & Orchestration
        APIServer[🌐 API Server (Node.js)]
        ECS[⚙️ AWS ECS (Fargate)]
        ECR[📦 AWS ECR]
    end

    subgraph Build & Deployment
        subgraph "ECS Task (Ephemeral)"
            direction LR
            BuilderContainer[🔧 Builder Container]
        end
        GitHub[☁️ GitHub]
        S3[🗂️ AWS S3 (Artifacts)]
    end

    subgraph Logging Pipeline
        Kafka[🔴 Kafka (Log Stream)]
        KafkaConsumer[ Verbraucher]
        ClickHouse[💾 ClickHouse (Log Storage)]
    end

    subgraph Serving Deployed App
        ProxyServer[🔄 Proxy Server]
        S3_Deployed[🗂️ AWS S3 (Deployed App)]
    end

    %% User to API
    User -- "1. Submits GitHub URL" --> APIServer

    %% API to ECS
    APIServer -- "2. Triggers ECS Task" --> ECS

    %% ECS, ECR, and the Builder
    ECS -- "3. Pulls Image" --> ECR
    ECS -- "4. Runs Container" --> BuilderContainer

    %% Builder's Workflow
    BuilderContainer -- "5. Clones Repo" --> GitHub
    BuilderContainer -- "6. Streams Logs" --> Kafka
    BuilderContainer -- "7. Uploads Build Artifacts" --> S3

    %% Logging Flow
    Kafka --> KafkaConsumer
    KafkaConsumer -- "8. Pushes Logs" --> ClickHouse
    APIServer -- "9. Polls for Logs" --> ClickHouse
    ClickHouse -- "10. Returns Logs" --> APIServer
    APIServer -- "11. Sends Logs to User" --> User

    %% Serving the Deployed Application
    User -- "12. Accesses Deployed App URL" --> ProxyServer
    ProxyServer -- "13. Fetches Content" --> S3
    S3 -- "14. Serves Content" --> ProxyServer
    ProxyServer -- "15. Returns Content to User" --> User

    %% Linking S3 buckets to clarify their roles
    linkStyle 6 stroke-width:2px,fill:none,stroke:green;
    linkStyle 11 stroke-width:2px,fill:none,stroke:blue;
    S3 --- S3_Deployed
