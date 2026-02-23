output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "rds_host" {
  description = "RDS instance hostname"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "ElastiCache port"
  value       = aws_elasticache_replication_group.main.port
}

output "ssm_parameter_arns" {
  description = "ARNs of the SSM parameters"
  value = {
    jwt_secret        = aws_ssm_parameter.jwt_secret.arn
    database_user     = aws_ssm_parameter.database_user.arn
    database_password = aws_ssm_parameter.database_password.arn
  }
}

output "app_iam_role_arn" {
  description = "IAM role ARN to annotate the K8s service account"
  value       = aws_iam_role.app.arn
}
