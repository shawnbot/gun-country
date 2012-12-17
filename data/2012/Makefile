CSV = $(shell ls *.csv)

all: tsv
	echo $(CSV)

tsv: $(CSV:%.csv=%.tsv)

%.tsv: %.csv
	../csv2tsv.py $< > $@

clean:
	rm -f *.tsv
