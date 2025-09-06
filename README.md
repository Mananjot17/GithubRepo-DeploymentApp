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


```mermaid
graph TD
    subgraph "User & API Layer"
        User[👨‍💻 User]
        APIServer[🌐 API Server (Node.js)]
    end

    subgraph "Build & Deployment Pipeline (AWS)"
        ECS[⚙️ AWS ECS (Fargate)]
        ECR[📦 AWS ECR]
        BuilderContainer["Ephemeral Builder Container"]
        S3[🗂️ AWS S3 Bucket<br/>(Stores Build Artifacts)]
    end

    subgraph "Real-time Logging Pipeline"
        Kafka[🔴 Kafka Topic]
        LogConsumer[📜 Log Consumer Service]
        ClickHouse[💾 ClickHouse Database]
    end

    subgraph "Serving Layer"
        ProxyServer[🔄 Reverse Proxy Server]
    end

    %% --- WORKFLOW ---

    %% 1. Deployment Request
    User -- "1. POST /deploy {repoUrl}" --> APIServer

    %% 2. Build Trigger
    APIServer -- "2. Triggers ECS Task" --> ECS
    ECS -- "3. Pulls image" --> ECR
    ECS -- "4. Runs Builder Container" --> BuilderContainer

    %% 3. In-Container Build Process
    BuilderContainer -- "5. Clones code" --> GitHub((☁️ GitHub Repo))
    BuilderContainer -- "6. Streams build logs" --> Kafka
    BuilderContainer -- "7. Uploads build output ('dist/')" --> S3

    %% 4. Logging Data Flow
    Kafka -- "8. Consumed by" --> LogConsumer
    LogConsumer -- "9. Inserts logs into" --> ClickHouse
    APIServer -- "10. Polls for logs (GET /logs/:id)" --> ClickHouse
    ClickHouse -- "11. Returns logs" --> APIServer
    APIServer -- "12. Sends logs to User (SSE/Polling)" --> User

    %% 5. Serving the Deployed Application
    User -- "13. Visits app-url.com" --> ProxyServer
    ProxyServer -- "14. Fetches static files from" --> S3
    S3 -- "15. Serves files to" --> ProxyServer
    ProxyServer -- "16. Returns content to User" --> User
```
