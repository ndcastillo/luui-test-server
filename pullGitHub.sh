cd ~/luui-test-server
git pull
pm2 stop 0
pm2 delete 0
pm2 start bun --name="app" -- run start