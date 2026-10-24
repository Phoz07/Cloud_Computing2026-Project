output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_ca" {
  description = "Base64 CA bundle — the root's helm provider decodes it."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "node_group_id" {
  description = "Exists so the root's helm releases can depend on schedulable nodes."
  value       = aws_eks_node_group.default.id
}

output "node_security_group_id" {
  value = local.node_security_group_id
}

output "nlb_dns_name" {
  description = "Public NLB hostname → ingress-nginx. `curl http://<this>/api/events/health` after deploy."
  value       = aws_lb.ingress.dns_name
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_address" {
  value = aws_db_instance.main.address
}

output "rds_master_secret_arn" {
  description = "Secrets Manager ARN with DATABASE_URL + BETTER_AUTH_SECRET — scripts/deploy.sh reads it."
  value       = aws_secretsmanager_secret.db_master.arn
}
