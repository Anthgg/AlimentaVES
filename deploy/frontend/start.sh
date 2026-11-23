#!/bin/sh
set -eu

sed "s/__PORT__/${PORT:-8080}/g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
