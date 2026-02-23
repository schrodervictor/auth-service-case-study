terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket         = "marta-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "marta-terraform-lock"
    encrypt        = true
  }
}
