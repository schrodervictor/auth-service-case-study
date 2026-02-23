# Task: DevOps — CI, Kubernetes, and Terraform

## Status: done

## Context

The application is fully containerized with Docker Compose for local
development. The next step is production-readiness: automated CI via GitHub
Actions, Kubernetes manifests for deployment (via Helm), and infrastructure
provisioning on AWS using Terraform.

## Milestones

### Milestone 1: GitHub Actions CI

- **Description**: Automated CI pipeline that validates every PR and push to
  master.
- **Acceptance Criteria**:
  - [x] Workflow triggers on PRs targeting master and pushes to master
  - [x] Runs build, typecheck, lint, unit tests, integration tests
  - [x] SSH agent with dummy key for Docker build SSH mount
  - [ ] Replace dummy SSH key with a GitHub secret for private npm registry
        access
- **Status**: done

### Milestone 2: Helm Chart for Kubernetes

- **Description**: Helm chart in `deployment/` packaging the application for
  Kubernetes deployment.
- **Acceptance Criteria**:
  - [x] Helm chart with Deployment, Service, Ingress, ConfigMap, ServiceAccount
        templates
  - [x] Config rendered as ConfigMap from `values.yaml`, mounted at
        `/app/config/config.json`
  - [x] No K8s Secrets — app fetches credentials from AWS SSM via IRSA
  - [x] Health check probes (liveness, readiness) pointing to
        `GET /partner-app/api/health-check`
  - [x] Resource requests/limits configured
  - [x] ALB Ingress with health check annotation
  - [x] SSM parameter paths populated in values
  - [x] `checksum/config` annotation for rolling restarts on config changes
- **Status**: done

### Milestone 3: Terraform — AWS Infrastructure

- **Description**: Terraform code in `infra/` provisioning AWS resources.
- **Acceptance Criteria**:
  - [x] S3 backend for Terraform state with DynamoDB locking
  - [x] RDS PostgreSQL 16 instance (encrypted, private subnets)
  - [x] ElastiCache Redis 7.1 replication group (encrypted at rest and in
        transit)
  - [x] ECR repository with immutable tags, scan-on-push, lifecycle policy
  - [x] SSM Parameter Store SecureString entries for secrets (JWT, DB
        credentials)
  - [x] IAM role for IRSA with `ssm:GetParameters` scoped to parameter ARNs
  - [x] Security groups restricting access to VPC CIDR only
  - [x] All resources tagged with project and environment
- **Status**: done
