resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/marta/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
}

resource "aws_ssm_parameter" "database_user" {
  name  = "/marta/${var.environment}/database-user"
  type  = "SecureString"
  value = var.database_user
}

resource "aws_ssm_parameter" "database_password" {
  name  = "/marta/${var.environment}/database-password"
  type  = "SecureString"
  value = var.database_password
}
