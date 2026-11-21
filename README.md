# THE WORLD TODAY — Saturday 21 November 2026

[![news-image-20261121](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/mrmasudhafej-tech/news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/mrmasudhafej-tech/news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121)

A newspaper front page that sums up the world's news of **Saturday 21 November 2026** in one image, drawn from scratch in Node 22 (standard library only) — a hand-written 5×7 bitmap font, a small canvas library, and a from-scratch PNG encoder.

## The day's stories

- **World court: Myanmar guilty of genocide** — the ICJ rules Myanmar committed genocide against the Rohingya in 2017, the first time the court has held a state guilty of the crime; Myanmar calls the verdict unfair (Reuters, NHK, Dawn)
- **Russian missiles hit Poland as Kyiv bridges burn** — about 110 missiles and 400 drones overnight; at least eight killed, three Kyiv bridges destroyed; two missiles and a drone came down in Poland (Moneycontrol, Dawn)
- **Trump, Xi and Putin: peace talk, no deal** — the three leaders meet in Shenzhen on the APEC sidelines; Trump calls Putin "a friend of mine"; no breakthrough announced (News18, The Hindu)
- **Britain and EU clinch reset deal** — London and Brussels agree to reset post-Brexit ties; tuition-fee talks pushed back (Dawn)
- **Protests sweep Europe** — young crowds rally against inflation and arms spending (Dawn)
- **Fresh arson in Bangladesh** — arson attacks erupt as unrest grows before Sheikh Hasina's return (Dawn)
- **Houthis claim new Saudi strikes** — rebels say they hit targets in the kingdom; Riyadh's tallest tower was hit (Dawn)
- **Voyager 1: one light-day** — 49 years after launch, the first human-made object a light-day from Earth
- **Also today** — tech shares slide as Anthropic falls; Mamdani to close Rikers Island jail by 2032; an Anthropic researcher claims Claude proved the Riemann Hypothesis (unverified)

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` (1024×1024, deterministic — two runs produce identical bytes). No network at runtime.

## License

MIT — see [LICENSE](LICENSE).
