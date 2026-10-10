<div align="center">

# t1code

[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](./LICENSE)
[![npm](https://img.shields.io/npm/v/%40maria__rcks%2Ft1code?color=111111&label=npm&style=flat-square)](https://www.npmjs.com/package/@maria_rcks/t1code)
[![GitHub](https://img.shields.io/badge/github-maria--rcks%2Ft1code-111111?style=flat-square&logo=github)](https://github.com/maria-rcks/t1code)

<img src="./assets/repo/t1code-preview.webp" alt="t1code terminal UI screenshot" width="1000" />

_T3Code, but in your terminal._

</div>

### Fresh Arch Linux install

`bun` ships in the official `extra` repository:

```sh
sudo pacman -S bun git
```

Then either run instantly or install globally (see below). If you prefer the
upstream installer instead of pacman:

```sh
curl -fsSL https://bun.sh/install | bash
```

> [!NOTE]
> No other prerequisites are required for a fresh system.

Run instantly:

```sh
bunx @maria_rcks/t1code
```

Install globally:

```bash
bun add -g @maria_rcks/t1code
```

Develop from source:

```bash
git clone https://github.com/maria-rcks/t1code.git
cd t1code
bun install
bun dev:tui
```

<sub>Based on T3 Code by [@t3dotgg](https://github.com/t3dotgg) and [@juliusmarminge](https://github.com/juliusmarminge).</sub>
