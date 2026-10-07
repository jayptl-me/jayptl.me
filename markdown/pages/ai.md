# I build it, and I use it.

> Jay Patel builds small language models from scratch and uses AI assistants daily, with clear lines on what AI never touches.

Two halves of the same habit: training small models to understand how they work, and using assistants every day without letting them own the decisions.

## What I build

- **Vini**, a ~50M BitNet b1.58 edge assistant, pretrained from scratch on ~1.05B tokens; instruction tuning in progress.
- **Tini**, an ~85M dense TypeScript model trained for about 46 hours on a single T4; weights not public yet. Vini's model card is on [Hugging Face](https://huggingface.co/jayptl-rq).
- **A self-hosted agent stack**: local inference, n8n workflows wired to MCP tool servers, and RAG over Qdrant and Chroma.
- **AI inside client products**, like provider matching and compliance insights at Thhiya.

[Read the Vini and Tini case study](https://jayptl.me/projects/vini-tini)

## How I use it

Assistants are in my editor and terminal every day. They are good at first drafts, repetitive refactors, test scaffolding, reading unfamiliar code with me, and research I then verify.

## What I never hand to it

- **Client data and secrets.** Keys, tokens, customer records and private code stay out of any tool that is not cleared for them.
- **Architecture sign-off.** An assistant can argue a design with me; the decision and its trade-offs are mine.
- **Security calls.** Auth, permissions and payment flows get human review, line by line.
- **Code I have not read.** Nothing ships under my name that I could not explain in a review.
- **Claims I cannot back.** Numbers on this site and my resume are ones I can show.
