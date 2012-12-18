all: atf-states.csv

nst-minimal.csv: nst_2011.csv
	csvcut -c NAME,POPESTIMATE2011 $< \
		| sed "1 s/NAME/state/" \
		| sed "1 s/POPESTIMATE2011/population/" > $@

atf-licensees.csv:
	cp 2012/08-nfa-registered-weapons-by-state_2012-03.csv $@

atf-registered.csv: 2012/09-nfa-special-occupational-taxpayers-by-state_2011.csv 
	cat $< | sed '1 s/([^,"]+)/reg $$1/g' > $@

atf-taxpayers.csv: 2012/11-federal-firearms-licensees-by-state_2011.csv
	cat $< | sed '1 s/([^,"]+)/tax $$1/g' > $@

atf-states.csv: \
	nst-minimal.csv \
	atf-licensees.csv \
	atf-registered.csv \
	atf-taxpayers.csv
	csvjoin -c state,State nst-minimal.csv atf-licensees.csv \
		| csvcut -C State \
		| csvjoin -c state,State - atf-registered.csv \
		| csvcut -C State \
		| csvjoin -c state,State - atf-taxpayers.csv > $@

clean:
	rm -f nst-minimal.csv
	rm -f atf-*.csv