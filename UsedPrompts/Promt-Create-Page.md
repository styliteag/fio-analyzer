Okay, Now think of a new page Host.tsx where i select only one host. Add a link in Home.tsx  Use only data from /api/test-runs, not from time-series no historic data.

A user should be see clearly charts to measure the hosts. 

As you can see in the data, a host can have more than 24 runs maybe even on more than one disk. 

Thin of way how to present  this to the User. It should be Interactive. Do not look at the other visulazations, maybe use more than one diagram at the same time, think of something new! 
Never use time-series or a time-based x-axis. A host can have many runs , a runs could have started with differnt parameters. (Look at /api/filters, or look at the test-runs 
of a host like redshark).

Show Diagram which give a overview How fast the host (and different disks) are. Make some Charsts and Number. Be creative. If you want to look at data user host_name=redshark

Use react where it is possible. Ultrathink what a nice and clean Interface would be.
