---
name: k8s-deployment-check
description: Use when checking if a recent Kubernetes deployment is healthy — switching contexts/stages, monitoring pod readiness, port init, and scanning ERROR-level logs for failures.
---

# Kubernetes Deployment Health Check

Verify a recent Kubernetes deployment: switch target, wait for rollout, check pod readiness, scan ERROR logs.

## Workflow

Flow: **Switch context** → **Wait for deployment** → **Check port init** → **Scan ERROR logs**

### 1. Switch Stage

```bash
swe stage    # switch to stage context
swe production   # switch to production
```

### 2. Wait for Deployment Readiness

Use `hwatch` to watch the deployment until it stabilizes:

```bash
hwatch -n 2 "kubectl get pods -l app=<service-name> | grep -v 'ContainerCreating\|Terminating\|Pending\|CrashLoopBackOff\|Init:0/'"

# Or use kubectl rollout status
kubectl rollout status deployment/<service-name> --timeout=300s
```

### 3. Check Port Init (how long & success)

```bash
# Check pod init container completion time
kubectl get pods -l app=<service-name> -o jsonpath='{range .items[*]}{.status.initContainerStatuses[*].state.terminated.finishedAt}{"\n"}{end}'

# Or get full pod status for a quick overview
kubectl get pods -l app=<service-name>
```

### 4. Scan ERROR Logs

```bash
kubectl logs -l app=<service-name> --tail=500 | grep -i "ERROR\|FATAL\|Exception\|Traceback"
```

## Common Service Names

| Service | Description |
|---------|-------------|
| `be-dynamic-pricing` | Backend dynamic pricing service |
| (add your own) | |

## Tips

- Use `hwatch -n 2 <cmd>` to keep polling every 2 seconds instead of manually re-running
- Pipe logs to an output file if there's too much output: `kubectl logs ... > /tmp/deploy-logs.txt`
- For longer log scanning combine `--tail` with `--since=5m` instead of `--tail=500`
- If `hwatch` is not available, fall back to a bash loop: `while true; do clear; <cmd>; sleep 2; done`
