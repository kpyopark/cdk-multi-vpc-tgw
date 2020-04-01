sudo docker run --name squid -d --restart=always \
 --publish `curl http://169.254.169.254/latest/meta-data/local-ipv4`:3128:3128 \
 --volume /srv/docker/squid/cache:/var/spool/squid \
 --volume /home/ec2-user/squid.conf:/etc/squid/squid.conf \
 --volume /home/ec2-user/whitelist.txt:/etc/squid/whitelist.txt \
 sameersbn/squid:3.5.27-2
