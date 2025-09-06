
<img width="1000" height="600" alt="ChatGPT Image Sep 6, 2025, 04_17_17 PM" src="https://github.com/user-attachments/assets/5f363223-e33e-48f9-9240-0cd78eb9ad9c" />

---

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


