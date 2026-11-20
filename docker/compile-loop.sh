#!/bin/sh
set -eu

while :; do
  for ready in /work/to-toan-tex-*/.ready; do
    [ -f "$ready" ] || continue
    directory=${ready%/.ready}
    mv "$ready" "$directory/.running" || continue
    (
      cd "$directory"
      case "$(cat .mode)" in
        pdflatex) mode=-pdf; limit=30s ;;
        xelatex) mode=-pdfxe; limit=30s ;;
        lualatex) mode=-pdflua; limit=90s ;;
        *) printf 'Unknown compiler\n' > main.stdout; printf '2' > .exit; mv .running .done; exit 0 ;;
      esac
      status=0
      timeout -k 5s "$limit" latexmk -norc "$mode" -interaction=nonstopmode \
        -halt-on-error -file-line-error \
        -e '$pdflatex=q/pdflatex -no-shell-escape %O %S/; $xelatex=q/xelatex -no-shell-escape %O %S/; $lualatex=q/lualatex -no-shell-escape %O %S/;' \
        main.tex > main.stdout 2>&1 || status=$?
      printf '%s' "$status" > .exit
      mv .running .done
    )
  done
  sleep 1
done
