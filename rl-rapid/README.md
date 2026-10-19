# Isolated Robot Academy Deep RL model memory

This branch stores only research-only, per-chart PyTorch DQN checkpoints under `models/` and one read-only summary at `rl-rapid/latest.json`. It does NOT contain private API keys, actual accounts, broker order functions, Teacher admissions, or certified forward-paper results.

The separate, restricted GitHub Actions workflow on `main` is the only intended writer and updates this branch after training all ten pupils and checking hashes and held-out boundaries. DQN checkpoints resume next batch from previously trained network weights.

Important: historical 15-minute candles are replayed faster than wall-clock time; reported decisions/second and simulated trade closes/second are NOT orders or one-second market observations. Repeating the same bars improves the in-sample optimisation process at best, not independent predictive evidence. Final 20% sealed history remains excluded from training and development validation.
