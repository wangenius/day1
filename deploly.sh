#!/bin/bash

# 设置错误时退出
set -e

# 基本设置
_DEPLOY_DIR="/data/web"
_REPO="startup-mod"
_FRONT_DIR="${_REPO}/client"
_BACK_DIR="${_REPO}/server"
_BASEDIR=$(dirname $0)

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 错误处理
error_exit() {
    log "ERROR: $1"
    exit 1
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        error_exit "$1 命令未找到，请先安装"
    fi
}

# 检查必要的命令
check_command git
check_command npm
check_command python
check_command rsync

pushd ${_BASEDIR} > /dev/null

# 部署前端
log "开始部署前端..."
cd "${_FRONT_DIR}" || error_exit "无法进入前端目录: ${_FRONT_DIR}"
git pull origin main || error_exit "前端代码拉取失败"
npm --registry=https://registry.npmmirror.com install || error_exit "前端依赖安装失败"
npm run build || error_exit "前端构建失败"
mkdir -p ${_DEPLOY_DIR}
rm -rf ${_DEPLOY_DIR}/*
rsync -avtP dist/ ${_DEPLOY_DIR} || error_exit "前端文件同步失败"
sudo systemctl restart nginx.service || error_exit "Nginx重启失败"
log "前端部署完成"

# 部署后端
log "开始部署后端..."
cd "${_BACK_DIR}" || error_exit "无法进入后端目录: ${_BACK_DIR}"
git pull origin main || error_exit "后端代码拉取失败"

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    log "创建虚拟环境..."
    python -m venv .venv || error_exit "虚拟环境创建失败"
fi

source .venv/bin/activate || error_exit "虚拟环境激活失败"
pip install -r requirements.txt || error_exit "后端依赖安装失败"

# 停止现有的后端进程
log "停止现有后端进程..."
pkill -f "python src/app.py" || true

# 使用后台运行
log "启动后端服务..."
nohup python src/app.py > app.log 2>&1 &
BACKEND_PID=$!
log "后端服务已启动（PID: $BACKEND_PID）"

# 等待几秒检查进程是否正常启动
sleep 3
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    error_exit "后端服务启动失败，请检查 app.log 文件"
fi

# 恢复目录
popd > /dev/null
log "部署完成！"
log "后端服务PID: $BACKEND_PID"
log "后端日志文件: ${_BACK_DIR}/app.log"