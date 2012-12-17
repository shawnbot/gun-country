#!/usr/bin/env python
import csv, re

MONEY_PAT = re.compile("\$?((\d+,?)+)", re.MULTILINE)
MONEY_REPLACE = lambda m: m.group(1).replace(",", "")

def unmoney(money):
    return re.sub(MONEY_PAT, MONEY_REPLACE, money)

def cleanup_atom(atom):
    return unmoney(atom.strip())

def csv2tsv(in_fp, out_fp):
    reader = csv.reader(in_fp, dialect="excel")
    writer = csv.writer(out_fp, dialect="excel-tab")
    for row in reader:
        row = map(cleanup_atom, row)
        writer.writerow(row)

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        fp = open(sys.argv[1], "rU")
        csv2tsv(fp, sys.stdout)
    else:
        csv2tsv(sys.stdin, sys.stdout)
