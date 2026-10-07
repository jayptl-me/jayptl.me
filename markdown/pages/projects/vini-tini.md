# Vini & Tini, Case Study

> How Jay Patel trained two small language models from scratch: Vini, a ~50M BitNet b1.58 edge assistant, and Tini, an ~85M dense TypeScript coding model.

*AI/ML research · Vini on [Hugging Face](https://huggingface.co/jayptl-rq).*

Everyone can call an LLM API. Jay wanted to know what it takes to build one: two small language models trained from scratch, a BitNet b1.58 edge assistant meant to run his home and a dense transformer that writes TypeScript. No fine-tuned checkpoints of someone else's homework.

## The problem, and why "just use an API" wasn't the answer

Commercial LLMs are brilliant and borrowed: prompts leave the building, the assistant lives in someone else's pricing tier, and nothing runs when the internet doesn't. The goal was an assistant that lives on the desk, answers in milliseconds, keeps working during network blackouts, and a compact coding model specialized for TypeScript backend work, inspectable and Apache 2.0 licensed. Small models, local hardware.

## My role

Sole researcher-engineer: dataset collection and curation, tokenizer strategy, training-loop implementation in PyTorch, evaluation harnesses, and deployment packaging, the full pipeline from raw text to a model with a job. Every experiment logged, every checkpoint versioned.

## Why BitNet for Vini, and not for Tini

BitNet b1.58 quantizes weights to three values, −1, 0, +1, replacing most multiplications with additions. The payoff is brutal efficiency: dramatically smaller memory footprint and energy-per-token, precisely the currency of edge devices. For an assistant meant to live on a Raspberry Pi, ternary weights are the enabling technology, not a compromise. Tini took the other road: a dense transformer (RoPE, RMSNorm, SwiGLU, grouped-query attention), because code quality at ~85M parameters needed every bit of precision.

## Training them

- **Vini (the assistant)**, ~50M BitNet b1.58, pretrained on ~1.05B tokens (FineWeb-Edu, StarCoder TypeScript and Dart, tool traces, OpenHermes) for ~17.6h on a single L4, then curriculum-staged instruction data for chat, IoT commands, and tool routing. Instruction tuning is still in progress.
- **Tini (the coder)**, ~85M dense transformer on ~257k cleaned TypeScript samples from The Stack (MinHash dedupe, secret scrubbing), 32k SentencePiece tokenizer, 15 epochs on a T4 for ~46h. Validation loss fell from 2.07 to 1.31.
- **Evaluation**, qualitative probes and loss tracking. The gap, no pass@k and no task-level benchmark, is the main lesson carried into v2.

## Shipping it

Vini's model card and training configs are public at [jayptl-rq/vini-pico](https://huggingface.co/jayptl-rq/vini-pico) on Jay's [Hugging Face profile](https://huggingface.co/jayptl-rq). Tini's weights are not public yet. Vini was designed to plug into a self-hosted stack: Ollama-based local inference, n8n workflows with MCP connectors for tool calls, and Qdrant vector storage for retrieval. Both v1 models are now retired on purpose; their postmortems (dense-first architecture, instruction-tuning gates, real evals) drive the multi-expert rebuild.

## What it proves

- ML engineering beyond API consumption: tokenizers, training loops, quantization-aware training, and architecture choices, owned end to end.
- Open-source contribution with real hygiene: license, docs, reproducibility artifacts.
- Systems thinking across the full AI stack, training, serving (FastAPI/Hono), orchestration (n8n + MCP), and retrieval (Qdrant/Chroma).
- Judgment about trade-offs: knowing when 1.58-bit ternary weights earn their place, and when they don't.

## What I learned

Data quality beats architecture cleverness more often than Twitter admits. Evaluation is the actual product, a model without a benchmark you trust is a vibe. And hardware limits are clarifying: when your model has to fit on a board the size of a credit card, every design choice becomes honest. So do the results: ~50M ternary parameters on ~1B tokens is not a fluent assistant, which is exactly why the rebuild starts dense.

## More

- All projects: [projects page](/projects.md)
- About Jay: [about page](/about.md)
