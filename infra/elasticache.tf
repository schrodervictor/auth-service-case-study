resource "aws_security_group" "redis" {
  name_prefix = "marta-${var.environment}-redis-"
  description = "Allow Redis access from within the VPC"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "marta-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "marta-${var.environment}"
  description          = "Redis for marta ${var.environment}"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = 1
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = false
}
