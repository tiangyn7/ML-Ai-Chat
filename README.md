ML-AI-CHAT 项目
目录

1. 项目简介

2. 项目结构

3. 功能特性

4. 环境准备

4.1 Python 环境

4.2 创建并激活虚拟环境

4.3 安装依赖

4.4 配置 API 密钥

5. 数据文件准备

5.1 qa_data.jsonl (精确问答数据)

5.2 prompts.jsonl (LLM 系统指令)

6. 运行项目

7. 体验地址

8. 技术框架与依赖

8.1 后端依赖（Python）

8.2 前端依赖

8.3 数据依赖

9. API 接口说明

10. 注意事项

1. 项目简介
这是一个基于 Flask 构建的简单聊天机器人后端服务，集成了精确问答匹配和大型语言模型（LLM）调用功能。它旨在提供一个灵活的聊天体验，既能对预设问题给出固定回复，也能在没有特定匹配时，通过 LLM 扮演“AG超玩会梦泪”的角色进行智能对话。

2. 项目结构
ML-AI-CHAT/
├── .env                  # 存储敏感环境变量 (例如 API 密钥)，请勿提交到 Git!
├── README.md             # 项目主说明文档 (当前文件)
├── backend/              # Flask 后端应用代码
│ ├── app.py              # 主应用文件
│ ├── config.py           # API 客户端配置 (包含你的豆包 API Key 和 client 初始化)
│ └── requirements.txt    # Python 依赖列表
├── data/                 # 存储 LLM 相关的 JSONL 数据文件
│ ├── qa_data.jsonl       # 精确匹配的问答对
│ └── prompts.jsonl       # LLM 的系统指令/角色设定
└── frontend/             # 网页界面文件
├── index.html            # 聊天界面 HTML
└── ... (其他前端资源，如 CSS/JS)
└── venv/                 # Python 虚拟环境，请勿提交到 Git!

3. 功能特性
精确问答匹配： 对特定用户输入（如“韩信在干嘛”、“你好”）提供预设的、硬编码的回复，响应速度快。

LLM 智能对话： 当用户问题没有精确匹配时，将请求转发给豆包 LLM，并结合预设的“AG超玩会梦泪”角色设定进行回复。

角色设定分离： LLM 的角色设定存储在 prompts.jsonl 中，易于管理和修改。

问答数据外部化： 精确匹配的问答对存储在 qa_data.jsonl 中，便于增删改查，无需修改代码。

跨域支持： 已配置 CORS，便于前端在不同域进行开发调试。

4. 环境准备
在运行项目之前，请确保你的系统满足以下要求并完成必要的配置。

4.1 Python 环境
建议使用 Python 3.8+。

4.2 创建并激活虚拟环境
为了更好地管理项目依赖，强烈建议使用虚拟环境。

# 进入项目根目录
cd ML-AI-CHAT/

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境 (macOS/Linux)
source venv/bin/activate

# 激活虚拟环境 (Windows)
.\venv\Scripts\activate

4.3 安装依赖
激活虚拟环境后，安装 backend/requirements.txt 中列出的所有依赖：

# 确保你位于项目根目录，或者在 backend 目录下执行
cd ML-AI-CHAT/backend/
pip install -r requirements.txt

4.4 配置 API 密钥
你的豆包 API 密钥应存放在项目根目录的 .env 文件中。

在 ML-AI-CHAT/ 目录下创建名为 .env 的文件。

在 .env 文件中添加你的 API 密钥：

DOUBAO_API_KEY="你的豆包API密钥"

注意： 确保你的 config.py 能够正确读取这个环境变量。例如，如果使用 python-dotenv 库，你的 config.py 应该类似这样：

import os
from dotenv import load_dotenv # 导入 load_dotenv
from doubao.client import DoubaoClient # 假设这是你的豆包客户端库

# 在这里加载 .env 文件，确保在环境变量被读取前执行
load_dotenv()

# 从环境变量加载 API 密钥
DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY")

# 初始化 DoubaoClient
client = DoubaoClient(api_key=DOUBAO_API_KEY)

5. 数据文件准备
在 ML-AI-CHAT/data/ 目录下，确保存在以下两个 .jsonl 文件：

5.1 qa_data.jsonl (精确问答数据)
每行一个 JSON 对象，包含 query 和 response 字段。

文件内容示例：

{"query": "你好", "response": "111！我是AG超玩会梦泪，扣1送地狱火！"}

5.2 prompts.jsonl (LLM 系统指令)
每行一个 JSON 对象，包含 LLM 的角色设定。

文件内容示例：

{"role": "system", "content": "你是AG超玩会梦泪。你会用夸张表情和游戏梗互动，用直播互动话术回应粉丝，用简洁游戏术语解决问题，用直播整活话术回应互动，用东北方言梗回应提问，用中二风格介绍自己，用夸张故事讲述游戏经历，用狗血剧情回应情感提问，用抒情诗歌回应思念提问，用反差语录回应质疑。"}

6. 运行项目
激活虚拟环境 (如果尚未激活)。

启动后端服务：

cd ML-AI-CHAT/backend/
python app.py

服务默认将在 http://0.0.0.0:5000 运行。

访问前端页面：
在浏览器中打开 ML-AI-CHAT/frontend/index.html 文件，或者通过你的前端服务器访问。

7. 体验地址
可以访问以下网址体验项目：https://dalonggou.xyz/

8. 技术框架与依赖
8.1 后端依赖（Python）
Flask - 微框架，用于构建后端服务。

python-dotenv - 从 .env 文件中加载环境变量，管理敏感信息（如 API 密钥）。

Flask-CORS - 跨域资源共享，允许前端与后端分开部署时进行通信。

requests - HTTP 请求库，用于与豆包 API 进行交互。

安装：

pip install -r requirements.txt

8.2 前端依赖
HTML5/CSS3/JavaScript - 用于前端构建用户界面。

Tailwind CSS - 一个功能强大的低级 CSS 框架，用于快速构建定制化的 UI。

jQuery - 提供更简洁的 DOM 操作和异步请求功能。

安装：

# 在前端文件夹中，运行以下命令安装 Tailwind CSS (如果需要本地编译)
npm install tailwindcss postcss autoprefixer --save-dev

8.3 数据依赖
JSONL 文件格式 - 用于存储精确问答数据 (qa_data.jsonl) 和 LLM 角色设定 (prompts.jsonl)，便于动态管理数据。

豆包 API - 用于访问 LLM 并获取智能回复。

9. API 接口说明
POST /api/chat

请求体 (JSON):

{
    "message": "用户输入的消息"
}

响应体 (JSON):

成功：

{
    "message": "AI 或预设的回复",
    "status": "success"
}

错误：

{
    "error": "错误信息",
    "status": "error"
}

10. 注意事项
在生产环境中，请配置 Nginx 或其他反向代理来处理跨域请求和 HTTPS。

确保你的 config.py 文件能够正确地从 .env 文件中加载 DOUBAO_API_KEY。
