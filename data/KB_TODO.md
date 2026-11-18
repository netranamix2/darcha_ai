# Knowledge base: what is still open (18.11.2026)

Master data: `my_findings/Darcha_данные.xlsx` (file 1 and the original file 2 are in `my_findings/archive/`).
Regenerate everything after editing it:

```bash
backend/.venv/bin/python scripts/import_findings.py ../my_findings/Darcha_данные.xlsx
backend/.venv/bin/python scripts/fetch_lex.py        # texts + statuses from lex.uz (cached)
backend/.venv/bin/python scripts/ingest_docs.py data/documents
```

## Resolved on 18.11 (team sheet `the_missing_files.xlsx`)
572 (correct page: -5641270, full text with scoring tables), PF-213, 824, 310 (the subsidy is in Appendix 2), 3849
(the full list of 465 positions, from the page's tables), plus 12 official Q&As on the 30% discount (gov.uz).
All downloaded, checked for repeal notices and indexed.

Also settled on 18.11 from lex.uz:
- **344** is active, **partly**: 578 (Appendix 6, point 27) voided only its point 4 and Appendix 2. Those parts are already
  missing from the lex.uz text, and the document title carries the restriction, so every citation shows it.
- **1950 → рег. №2321** (01.02.2012, amended by 2321-2 on 09.09.2022) is added as KB-040 and active.
- **2684 is NOT replaced.** "№913" was a search artifact; the document found is **2684-6 (28.08.2026)**, an amendment
  to 2684 (chapter 4 and an appendix). The lex.uz text is already the amended version, so nothing needs repealing.

## Needs a person (could not be settled automatically)
| KB | Document | What is open |
|---|---|---|
| KB-025 | Contract deadline extension | Expired on 01.11.2026. Kept with `valid_until`, so search will never cite it as current. |

Key points for 120, 527, 606, 59, 462, 300 and 2684 are **drafts written by Claude from the lex.uz texts**
(marked in the sheet). Check them before quoting them on slides.

## Gaps from the real questions (21 of 48 are not answerable)
- Labour law (3 questions): **added**, Mehnat kodeksi O'RQ-798 (KB-039, full text).
- Teacher bonuses (4): which acts set the certificate/category bonuses (*ustama*)? The 70% from ПКМ 572 is known; the rest is not.
- 12% income-tax refund for contract fees: the Tax Code (Soliq kodeksi) article on the social deduction for education.
- Kindergartens: the preschool education law and the PF-19 decree (05.02.2026) seen in lex.uz search; queue checks through navbat.uzedu.uz.
- kontrakt.edu.uz (two- vs three-party contract): not a legal act; needs an official instruction or a ministry FAQ page.

Until a document is added, these questions must stay non-green; `run_eval.py` checks this as "refuse".

## Comments
27 real comments, git-ignored in `data/comments/private/`, never committed. 300–500 are needed for clustering:
export them from the ministry's Telegram discussion group or Instagram, or collect them through the bot.
**Do not make them up**: the FAQ report would then describe invented complaints.
