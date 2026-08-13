/**
 * Anonymised sample paste — the exact tab-delimited text you get when you
 * select the hedge summary in the source workbook and copy it. Used to
 * pre-load the dashboard with a realistic book so it is never empty, and
 * as a fixture the paste parser is exercised against.
 *
 * Figures are illustrative (AUD/USD structured FX hedges); no real client.
 */
export const SAMPLE_PASTE = `
																								
 	Month	"Forecast
(USD)"	"Protection
(USD)"	"Current Obligation
(USD)"	"Potential Obligation
(USD)"	"Max Potential Obligation
(USD)"	Average Protection Rate																	
	01 Aug 26		441022	122272	637500	759772	0.647917																	
	01 Sep 26		973848	655098	698636	1353734	0.636879																	
	01 Oct 26		441022	122272	759772	882044	0.643687																	
	01 Nov 26		318750	0	637500	637500	0.635																	
	01 Dec 26		441022	122272	759772	882044	0.641739																	
	01 Jan 27		0	0	0	0	-																	
	01 Feb 27		0	0	0	0	-																	
	01 Mar 27		1000000	1000000	0	1000000	0.706																	
	01 Apr 27		1000000	1000000	0	1000000	0.706																	
	01 May 27		1000000	1000000	0	1000000	0.706																	
	01 Jun 27		1000000	1000000	0	1000000	0.706																	
	01 Jul 27		0	0	0	0	-																	
	01 Aug 27		0	0	0	0	-																	
	01 Sep 27		0	0	0	0	-																	
	01 Oct 27		0	0	0	0	-																	
	01 Nov 27		0	0	0	0	-																	
	01 Dec 27		0	0	0	0	-																	
	01 Jan 28		0	0	0	0	-																	
	01 Feb 28		0	0	0	0	-																	
	01 Mar 28		0	0	0	0	-																	
	01 Apr 28		0	0	0	0	-																	
	01 May 28		0	0	0	0	-																	
	01 Jun 28		0	0	0	0	-																	
	01 Jul 28		0	0	0	0	-																	
	01 Aug 28		0	0	0	0	-																	
	01 Sep 28		0	0	0	0	-																	
	01 Oct 28		0	0	0	0	-																	
	01 Nov 28		0	0	0	0	-																	
	01 Dec 28		0	0	0	0	-																	
	01 Jan 29		0	0	0	0	-																	
	01 Feb 29		0	0	0	0	-																	
	01 Mar 29		0	0	0	0	-																	
	01 Apr 29		0	0	0	0	-																	
	01 May 29		0	0	0	0	-																	
	01 Jun 29		0	0	0	0	-																	
	01 Jul 29		0	0	0	0	-																	
	01 Aug 29		0	0	0	0	-																	
	01 Sep 29		0	0	0	0	-																	
	01 Oct 29		0	0	0	0	-																	
	01 Nov 29		0	0	0	0	-																	
	01 Dec 29		0	0	0	0	-																	
	01 Jan 30		0	0	0	0	-																	
	01 Feb 30		0	0	0	0	-																	
	01 Mar 30		0	0	0	0	-																	
	01 Apr 30		0	0	0	0	-																	
	01 May 30		0	0	0	0	-																	
	01 Jun 30		0	0	0	0	-																	
	01 Jul 30		0	0	0	0	-																	
	01 Aug 30		0	0	0	0	-																	
	01 Sep 30		0	0	0	0	-																	
	01 Oct 30		0	0	0	0	-																	
	01 Nov 30		0	0	0	0	-																	
	01 Dec 30		0	0	0	0	-																	
	01 Jan 31		0	0	0	0	-																	
	01 Feb 31		0	0	0	0	-																	
	01 Mar 31		0	0	0	0	-																	
	01 Apr 31		0	0	0	0	-																	
	01 May 31		0	0	0	0	-																	
	01 Jun 31		0	0	0	0	-																	
	01 Jul 31		0	0	0	0	-																	
	01 Aug 31		0	0	0	0	-																	
		0	6615664	5021914	3493180	8515094	0.678541																	
																								
	Expiry	Forecast	"Protection
(USD)"	"Current Obligation
(USD)"	"Potential Obligation
(USD)"	"Max Potential Obligation
(USD)"	CCY	Product	"Protection
Strike"	"Participation
Strike"	Strike (i)	Strike (ii)	Trigger	Window Start Date	Window End Date	Window Length	Trigger 2	Window Start Date	Window End Date	Window Length	"Ticket
Number"	Trade Date	Comment / Ref	Credit
	31 Aug 26		122272	122272	0	122272	AUD/USD	FEC  (LHS)	0.6842												AFS3144560R2_001	29 Jul 26	    	178707.98
	31 Aug 26		318750	0	637500	637500	AUD/USD	Leveraged Knock In Improver Window (LHS)	0.6350				0.6350	17 Aug 26 06:00	31 Aug 26 06:00	14 days	0.6930	17 Aug 26 06:00	31 Aug 26 06:00	14 days	877414	22 Jan 26		1003937.01
	01 Sep 26		61136	61136	61136	122272	AUD/USD	Leveraged Variable Strike TARF (LHS)	0.675												877480	22 Jan 26	Points remaining: 705.5 of 800 (< 0.60445) [fff]	181143.703703704
	30 Sep 26		593962	593962	0	593962	AUD/USD	FEC  (LHS)	0.6342												AFS3145421_001	31 Jul 26	    	936553.14
	30 Sep 26		318750	0	637500	637500	AUD/USD	Leveraged Knock In Improver Window (LHS)	0.6350				0.6350	16 Sep 26 06:00	30 Sep 26 06:00	14 days	0.6930	16 Sep 26 06:00	30 Sep 26 06:00	14 days	877414	22 Jan 26		1003937.01
	01 Oct 26		61136	61136	61136	122272	AUD/USD	Leveraged Variable Strike TARF (LHS)	0.67												877480	22 Jan 26		182495.52238806
	30 Oct 26		318750	0	637500	637500	AUD/USD	Leveraged Knock In Improver Window (LHS)	0.6350				0.6350	16 Oct 26 06:00	30 Oct 26 06:00	14 days	0.6930	16 Oct 26 06:00	30 Oct 26 06:00	14 days	877414	22 Jan 26		1003937.01
	30 Oct 26		61136	61136	61136	122272	AUD/USD	Leveraged Variable Strike TARF (LHS)	0.665												877480	22 Jan 26		183867.669172932
	27 Nov 26		318750	0	637500	637500	AUD/USD	Leveraged Knock In Improver Window (LHS)	0.6350				0.6350	13 Nov 26 06:00	27 Nov 26 06:00	14 days	0.6930	13 Nov 26 06:00	27 Nov 26 06:00	14 days	877414	22 Jan 26		1003937.01
	01 Dec 26		61136	61136	61136	122272	AUD/USD	Leveraged Variable Strike TARF (LHS)	0.66												877480	22 Jan 26		185260.606060606
	30 Dec 26		61136	61136	61136	122272	AUD/USD	Leveraged Variable Strike TARF (LHS)	0.66												877480	22 Jan 26		185260.606060606
	31 Dec 26		318750	0	637500	637500	AUD/USD	Leveraged Knock In Improver Window (LHS)	0.6350				0.6350	17 Dec 26 06:00	31 Dec 26 06:00	14 days	0.6930	17 Dec 26 06:00	31 Dec 26 06:00	14 days	877414	22 Jan 26		1003937.01
	31 Mar 27		1000000	1000000	0	1000000	AUD/USD	Knock Out (LHS)	0.7060				0.6450								962987	03 Jul 26		1416430.59
	29 Apr 27		1000000	1000000	0	1000000	AUD/USD	Knock Out (LHS)	0.7060				0.6450								962987	03 Jul 26		1416430.59
	26 May 27		1000000	1000000	0	1000000	AUD/USD	Knock Out (LHS)	0.7060				0.6450								962987	03 Jul 26		1416430.59
	30 Jun 27		1000000	1000000	0	1000000	AUD/USD	Knock Out (LHS)	0.7060				0.6450								962987	03 Jul 26		1416430.59
`
