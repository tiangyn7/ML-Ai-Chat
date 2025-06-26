import os
from dotenv import load_dotenv
from volcenginesdkarkruntime import Ark

# 加载环境变量
load_dotenv(dotenv_path='../venv/Key.env') 

# 获取API密钥
DOUBAO_API_KEY = os.getenv("YOUR_API_KEY")

# 验证密钥是否存在
if not DOUBAO_API_KEY:
    raise ValueError("未设置DOUBAO_API_KEY环境变量")
else:
    print("DOUBAO_API_KEY 已成功加载！") # 添加这行来确认
    # 或者如果你想看到密钥的一部分（不推荐打印完整密钥到控制台）
    # print(f"DOUBAO_API_KEY 开头：{DOUBAO_API_KEY[:5]}...") 

# 初始化SDK客户端
client = Ark(api_key=DOUBAO_API_KEY)
print("Ark 客户端已初始化。") # 添加这行来确认
