# Vini & Tini — Case Study

> How Jay Patel trained two small language models from scratch on the BitNet b1.58 ternary architecture — Vini, an edge-first personal assistant, and Tini, a TypeScript coding model published on HuggingFace.

*AI/ML research · Published.*

Everyone can call an LLM API. Jay wanted to know what it takes to build one: two small language models trained from scratch on the BitNet b1.58 ternary architecture — one that runs his home, and one that writes TypeScript. No fine-tuned checkpoints of someone else's homework.

## The problem — and why "just use an API" wasn't the answer

Commercial LLMs are brilliant and borrowed: prompts leave the building, the assistant lives in someone else's pricing tier, and nothing runs when the internet doesn't. The goal was an assistant that lives on the desk, answers in milliseconds, keeps working during network blackouts — and a compact coding model specialized for TypeScript backend work, inspectable and Apache 2.0 licensed. Small models, local hardware.

## My role

Sole researcher-engineer: dataset collection and curation, tokenizer strategy, training-loop implementation in PyTorch, evaluation harnesses, and deployment packaging — the full pipeline from raw text to a model with a job. Every experiment logged, every checkpoint versioned.

## Why BitNet b1.58

BitNet b1.58 quantizes weights to three values — −1, 0, +1 — replacing most multiplications with additions. The payoff is brutal efficiency: dramatically smaller memory footprint and energy-per-token, precisely the currency of edge devices. For an assistant meant to live on a Raspberry Pi, ternary weights are the enabling technology, not a compromise.

## Training them

- **Vini (the assistant)** — trained on curated instruction data spanning conversational Q&A, command parsing, and tool-routing traces. An assistant's real skill is deciding which tool, not just generating text.
- **Tini (the coder)** — fed a diet of TypeScript backend code; trained notebooks and a HuggingFace dataset ship alongside the model.
- **Evaluation** — task-level benchmarks (does the timer actually get set? does the code actually compile?) rather than vanity perplexity alone.

## Shipping it

Tini is published on HuggingFace at [jayptl-rq/tini](https://huggingface.co/jayptl-rq) under Apache 2.0 — model card, dataset references, deployment configs included. Vini stays closer to home by design: it's the living brain of a self-hosted ecosystem, wired into Ollama-based local inference, n8n workflows with MCP connectors for tool calls, and Qdrant vector storage for retrieval. Vini runs daily.

## What it proves

- ML engineering beyond API consumption: tokenizers, training loops, evals, quantization-aware architecture choices — owned end to end.
- Open-source contribution with real hygiene: license, docs, reproducibility artifacts.
- Systems thinking across the full AI stack — training, serving (FastAPI/Hono), orchestration (n8n + MCP), and retrieval (Qdrant/Chroma).
- Judgment about trade-offs: knowing when 1.58-bit ternary weights beat a 70B-parameter cloud bill.

## What I learned

Data quality beats architecture cleverness more often than Twitter admits. Evaluation is the actual product — a model without a benchmark you trust is a vibe. And hardware limits are clarifying: when your model has to fit on a board the size of a credit card, every design choice becomes honest.

## More

- All projects: [projects page](/projects.md)
- About Jay: [about page](/about.md)
