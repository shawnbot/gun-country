all: atf-states.csv rtc-minimal.csv

nst-minimal.csv: nst_2011.csv
	csvcut -c STATE,NAME,POPESTIMATE2010 $< \
		| sed "1 s/STATE/fips/" \
		| sed "1 s/NAME/state/" \
		| sed "1 s/POPESTIMATE2010/population/" > $@

nics-minimal.csv: nics-checks-by-state.csv
	csvcut -c 1,3 $< \
		| sed "1 s/2010/NICS checks 2010/" \
		> $@

atf-licensees.csv:
	cp 2012/08-nfa-registered-weapons-by-state_2012-03.csv $@

atf-registered.csv: 2012/09-nfa-special-occupational-taxpayers-by-state_2011.csv 
	cat $< | sed '1 s/([^,"]+)/reg $$1/g' > $@

atf-taxpayers.csv: 2012/11-federal-firearms-licensees-by-state_2011.csv
	cat $< | sed '1 s/([^,"]+)/tax $$1/g' > $@

syg-minimal.csv: stand-your-ground.csv
	cat $< | csvcut -C 5 > $@

atf-states.csv: \
	nst-minimal.csv \
	atf-licensees.csv \
	atf-registered.csv \
	atf-taxpayers.csv \
	syg-minimal.csv \
	nics-minimal.csv
	csvjoin -c state,State nst-minimal.csv atf-licensees.csv | csvcut -C State \
		| csvjoin -c state,State - atf-registered.csv | csvcut -C State \
		| csvjoin -c state,State - atf-taxpayers.csv | csvcut -C State \
		| csvjoin -c state,State - syg-minimal.csv | csvcut -C State \
		| csvjoin -c state,State - nics-minimal.csv | csvcut -C State \
		> $@

rtc-minimal.csv: right-to-carry.csv
	cat $< \
		| perl -pi -e 's/No(-| )Issue/N/g' \
		| perl -pi -e 's/May(-| )Issue/M/g' \
		| perl -pi -e 's/Shall(-| )Issue/S/g' \
		| perl -pi -e 's/Unrestricted/U/g' \
		> $@

clean:
	rm -f nst-minimal.csv
	rm -f rtc-minimal.csv
	rm -f syg-minimal.csv
	rm -f nics-minimal.csv
	rm -f atf-*.csv
