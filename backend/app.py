import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests  # 用于处理 API 请求异常
import uuid  # 用于为上传的文件生成唯一文件名

# 配置日志记录
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- 路径定义和调试输出 ---
# 获取当前脚本（backend/）的绝对路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # 示例: D:\ML-Ai-Chat\backend
logging.info(f"DEBUG: BASE_DIR (app.py 文件所在目录): {BASE_DIR}")

# 项目根目录（D:\ML-Ai-Chat）是 BASE_DIR 的上一级目录
PROJECT_ROOT = os.path.join(BASE_DIR, '..')
PROJECT_ROOT = os.path.abspath(PROJECT_ROOT)  # 获取绝对路径以解析 '..'
logging.info(f"DEBUG: PROJECT_ROOT (项目根目录): {PROJECT_ROOT}")

# 定义关键目录的路径
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')  # 前端文件目录
GLOBAL_DATA_DIR = os.path.join(PROJECT_ROOT, 'data')  # 全局数据目录（用于 ml_data.jsonl 和 profiles.json）
UPLOADS_PATH = os.path.join(PROJECT_ROOT, 'uploads')  # 上传文件目录

logging.info(f"DEBUG: FRONTEND_DIR: {FRONTEND_DIR}")
logging.info(f"DEBUG: GLOBAL_DATA_DIR: {GLOBAL_DATA_DIR}")
logging.info(f"DEBUG: UPLOADS_PATH: {UPLOADS_PATH}")
# --- 路径定义和调试输出结束 ---

# 全局深度思考配置 - 控制深度思考模式的行为
DEEP_THOUGHT_CONFIG = {
    "default_mode": "on",  # 默认开启深度思考
    "temperature_on_mode": 0.5,  # 深度思考开启时的温度
    "temperature_off_mode": 0.1,  # 深度思考关闭时的温度（用于确定性回答）
    "temperature_auto_mode": 0.7,  # 深度思考自动模式时的温度（默认创意模式）
    # 触发自动深度思考的关键词（示例）
    "keyword_triggers": ["为什么", "如何", "分析", "推导", "证明", "原理", "逻辑", "原因", "解释"]
}

# 初始化 Flask 应用
app = Flask(__name__,
            static_folder=FRONTEND_DIR,  # 指定前端静态文件目录
            static_url_path='/frontend')  # 静态文件的 URL 前缀

CORS(app)  # 启用跨域资源共享

# 确保上传目录存在
if not os.path.exists(UPLOADS_PATH):
    os.makedirs(UPLOADS_PATH)
app.config['UPLOAD_FOLDER'] = UPLOADS_PATH

# 全局变量 - 存储预定义的问答和 AI 人设数据
PREDEFINED_QA = {}  # 存储精确匹配的预定义问答
PROFILES_DATA = {}  # 存储 AI 人设配置
MODEL_ID = "doubao-seed-1.6-250615"  # 使用的模型 ID


def load_jsonl_data(filepath, data_store):
    """
    将 .jsonl 格式的数据文件加载到指定的字典中。

    参数:
        filepath: 文件的路径。
        data_store: 用于存储加载数据的目标字典。
    """
    logging.info(f"DEBUG: 尝试加载 JSONL 文件: {filepath}")
    try:
        count = 0
        with open(filepath, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:  # 跳过空行
                    continue
                try:
                    item = json.loads(line)
                    if 'query' in item and 'response' in item:  # 检查必需字段
                        data_store[item['query'].lower()] = item['response']
                        count += 1
                except json.JSONDecodeError as e:
                    logging.error(f"JSON 解析错误: 文件 '{filepath}' 的第 {i + 1} 行格式错误 - {e}")
                    continue
        logging.info(f"成功从 '{filepath}' 加载 {count} 项数据。")
    except FileNotFoundError:
        logging.warning(f"文件未找到: '{filepath}'。跳过加载。")
    except Exception as e:
        logging.error(f"加载文件 '{filepath}' 时出现未知错误: {e}")


def load_profiles_data(filepath):
    """
    从 JSON 文件中加载 AI 人设数据。

    参数:
        filepath: 人设配置文件的路径。
    """
    logging.info(f"DEBUG: 尝试加载人设文件: {filepath}")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            profiles_list = json.load(f)  # 加载 JSON 数组
            for profile in profiles_list:
                if 'id' in profile and 'prompt' in profile:  # 验证必需字段
                    PROFILES_DATA[profile['id']] = profile
        logging.info(f"成功从 '{filepath}' 加载 {len(PROFILES_DATA)} 个人设项。")
    except FileNotFoundError:
        logging.error(f"人设文件 '{filepath}' 未找到。使用默认人设。")
        # 如果文件缺失，设置默认人设
        if 'default' not in PROFILES_DATA:
            PROFILES_DATA['default'] = {
                "id": "default",
                "name": "默认AI伴聊",
                "prompt": "你是一个有帮助的AI助手。",
                "initial_message": "你好，有什么我可以帮助你的吗？",
                "icon": "fas fa-robot"
            }
    except json.JSONDecodeError as e:
        logging.error(f"人设文件 JSON 格式错误: {e}")
        # 使用默认人设
        if 'default' not in PROFILES_DATA:
            PROFILES_DATA['default'] = {
                "id": "default",
                "name": "默认AI伴聊",
                "prompt": "你是一个有帮助的AI助手。",
                "initial_message": "你好，有什么我可以帮助你的吗？",
                "icon": "fas fa-robot"
            }
    except Exception as e:
        logging.error(f"加载人设数据时出现未知错误: {e}")
        if 'default' not in PROFILES_DATA:
            PROFILES_DATA['default'] = {
                "id": "default",
                "name": "默认AI伴聊",
                "prompt": "你是一个有帮助的AI助手。",
                "initial_message": "你好，有什么我可以帮助你的吗？",
                "icon": "fas fa-robot"
            }


def load_deep_thought_config():
    """
    从文件中加载深度思考配置。
    """
    config_path = os.path.join(GLOBAL_DATA_DIR, 'deep_thought_config.json')
    logging.info(f"DEBUG: 尝试从 {config_path} 加载深度思考配置。")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                global DEEP_THOUGHT_CONFIG
                loaded_config = json.load(f)
                # 仅更新默认配置中存在的键
                for key, value in loaded_config.items():
                    if key in DEEP_THOUGHT_CONFIG:
                        DEEP_THOUGHT_CONFIG[key] = value
            logging.info("深度思考配置加载成功。")
        except Exception as e:
            logging.warning(f"加载深度思考配置失败: {e}，使用默认配置。")
    else:
        logging.info("深度思考配置文件未找到，使用默认配置。")

    # 保存当前（默认或加载的）配置，确保如果文件不存在则写入
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(DEEP_THOUGHT_CONFIG, f, ensure_ascii=False, indent=2)
        logging.info(f"深度思考配置已保存到: {config_path}")
    except Exception as e:
        logging.error(f"保存深度思考配置时出错: {e}")


def get_deep_thought_prompt():
    """
    生成深度思考模式的提示信息。
    引导模型逐步进行思考过程，使用特定标签分隔思考过程和最终答案。
    """
    return """
请你严格按照以下格式进行输出，不要有多余的文字，确保每个标签都出现并顺序正确：
[THOUGHT_PROCESS_START]
1. 理解用户意图：分析用户最新消息的核心问题和上下文。
2. 结合人设：根据当前AI人设的设定，确定回复的语气、风格和内容侧重点。
3. 知识检索/思考：调用相关知识库（如数学定理、物理规律、历史事件等）。
4. 规划回复：分步骤推导逻辑链条，避免跳跃性结论。
5. 内容生成：基于上述分析生成结构化回答。
6. 检查与润色：验证逻辑一致性，调整表达风格。
[THOUGHT_PROCESS_END]
[FINAL_ANSWER_START]
"""


# 在应用启动时加载数据
load_jsonl_data(os.path.join(GLOBAL_DATA_DIR, 'ml_data.jsonl'), PREDEFINED_QA)
load_profiles_data(os.path.join(GLOBAL_DATA_DIR, 'profiles.json'))
load_deep_thought_config()  # 在此加载深度思考配置

# 确保至少有一个默认人设
if not PROFILES_DATA:
    logging.warning("未加载到人设数据，使用内置的最小默认人设。")
    PROFILES_DATA['default'] = {
        "id": "default",
        "name": "默认AI伴聊",
        "prompt": "你是一个有帮助的AI助手。",
        "initial_message": "你好，有什么我可以帮助你的吗？",
        "icon": "fas fa-robot"
    }


# --- 路由定义 ---

# 主页 - 返回前端 HTML 页面
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


# 静态资源路由 - 提供 CSS 和 JS 文件
@app.route('/frontend/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'css'), filename)


@app.route('/frontend/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'js'), filename)


# 提供全局数据文件的路由（例如 profiles.json, deep_thought_config.json）
@app.route('/data/<path:filename>')
def serve_global_data_files(filename):
    # 安全检查 - 防止目录遍历攻击
    if '..' in filename or filename.startswith('/'):
        logging.warning(f"检测到路径遍历攻击尝试: {filename}")
        return "无效路径", 400

    full_file_path = os.path.join(GLOBAL_DATA_DIR, filename)
    logging.info(f"尝试提供文件: {full_file_path}")

    if not os.path.exists(full_file_path):
        logging.error(f"文件未找到: {full_file_path}")
        return jsonify({"error": f"文件未找到: {filename}"}), 404

    return send_from_directory(GLOBAL_DATA_DIR, filename)


# 处理图像上传的路由
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "未找到文件部分"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "未选择文件"}), 400

    if file:
        # 生成唯一文件名，保留原始扩展名
        unique_filename = str(uuid.uuid4()) + os.path.splitext(file.filename)[1]
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        file_url = f'/uploads/{unique_filename}'
        logging.info(f"文件上传成功: {file_url}")
        return jsonify({"success": True, "url": file_url})

    logging.warning("文件上传失败。")
    return jsonify({"success": False, "message": "上传失败"}), 500


# 提供上传文件的路由
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    logging.info(f"提供上传的文件: {filename} 来自 {app.config['UPLOAD_FOLDER']}")
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# 深度思考配置 API - 获取或更新深度思考配置
@app.route('/api/config/deep_thought', methods=['GET', 'POST'])
def deep_thought_api():
    if request.method == 'GET':
        # 返回当前深度思考配置
        return jsonify(DEEP_THOUGHT_CONFIG)

    if request.method == 'POST':
        try:
            new_config = request.json
            # 修复：确保使用 new_config[key] 来更新 DEEP_THOUGHT_CONFIG
            for key in ['default_mode', 'temperature_on_mode', 'temperature_off_mode', 'temperature_auto_mode',
                        'keyword_triggers']:
                if key in new_config:
                    DEEP_THOUGHT_CONFIG[key] = new_config[key] 

            # 将配置保存到文件
            config_path = os.path.join(GLOBAL_DATA_DIR, 'deep_thought_config.json')
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(DEEP_THOUGHT_CONFIG, f, ensure_ascii=False, indent=2)

            return jsonify({"status": "success", "message": "深度思考配置已更新"})
        except Exception as e:
            logging.error(f"更新深度思考配置失败: {e}")
            return jsonify({"error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        # 解析请求数据
        data = request.json
        print("接收到的数据:", data)
        # 检查数据是否为字典格式
        if not isinstance(data, dict):
            logging.error(f"收到的消息格式错误，期望的是列表，但实际收到的是：{type(messages_from_frontend)}")
            return jsonify({"status": "error", "message": "请求数据格式错误"}), 400

        messages_from_frontend = data.get('messages', [])
        profile_id = data.get('profile_id', 'default')  # AI 人设 ID
        deep_thought_mode = data.get('deep_thought_mode', 'off').lower()

        # 检查消息是否为空
        if not isinstance(messages_from_frontend, list) or not messages_from_frontend:
            logging.warning("收到空消息列表或消息格式错误")
            return jsonify({"status": "error", "message": "消息不能为空"}), 400
        
        # 获取用户消息内容
        user_message_content = ""
        if messages_from_frontend and isinstance(messages_from_frontend, list) and messages_from_frontend[-1].get("role") == "user":
            user_message_content = messages_from_frontend[-1].get("content", "").strip()

        logging.info(f"收到的消息内容: {user_message_content}")
        # 空消息检查
        if not user_message_content:
            logging.warning("收到空消息")
            return jsonify({"status": "error", "message": "消息不能为空"}), 400

        # 获取所选人设的系统提示信息
        profile_info = PROFILES_DATA.get(profile_id, PROFILES_DATA['default'])
        current_profile_prompt = profile_info["prompt"]

        # 优先检查精确匹配的预定义答案
        if user_message_content.lower() in PREDEFINED_QA:
            predefined_answer = PREDEFINED_QA[user_message_content.lower()]
            logging.info(f"找到精确匹配: '{user_message_content}'")
            return jsonify({
                "message": predefined_answer,
                "status": "success",
                "reasoning": "找到精确匹配，无需深度思考。"
            })

        # 导入 Ark 客户端实例（从 config.py）
        try:
            from config import client
            logging.info("Ark 客户端导入成功。")
        except ImportError:
            logging.error("无法导入 Ark 客户端，请检查 config.py。")
            raise ImportError("Ark 客户端未配置。检查 config.py。")

        # 构建要发送给模型的消息列表
        messages_for_llm = []
        # 添加人设系统提示信息
        messages_for_llm.append({"role": "user", "content": current_profile_prompt})

        # 添加对话历史
        for msg in messages_from_frontend:
            role_map = 'user' if msg.get("role") == "user" else 'assistant'
            messages_for_llm.append({"role": role_map, "content": msg.get("content", "")})

        # 根据模式确定是否添加深度思考提示信息
        add_deep_thought_prompt = False
        effective_temperature = DEEP_THOUGHT_CONFIG["temperature_auto_mode"]  # 默认使用自动模式温度

        if deep_thought_mode == "on":
            add_deep_thought_prompt = True
            effective_temperature = DEEP_THOUGHT_CONFIG["temperature_on_mode"]
            logging.info("深度思考模式: 开启（强制）。")

        elif deep_thought_mode == "auto":
            # 自动模式 - 根据关键词确定是否需要深度思考
            user_last_msg = messages_from_frontend[-1]["content"] if messages_from_frontend else ""
            if any(keyword in user_last_msg for keyword in DEEP_THOUGHT_CONFIG["keyword_triggers"]):
                add_deep_thought_prompt = True
                effective_temperature = DEEP_THOUGHT_CONFIG["temperature_on_mode"]  # 自动触发时使用开启模式温度
                logging.info("自动模式: 关键词触发深度思考。")
            else:
                effective_temperature = DEEP_THOUGHT_CONFIG["temperature_auto_mode"]  # 未触发时使用自动模式温度
                logging.info("自动模式: 未检测到深度思考关键词。")

        elif deep_thought_mode == "off":
            effective_temperature = DEEP_THOUGHT_CONFIG["temperature_off_mode"]
            logging.info("深度思考模式: 关闭（温度设置较低）。")

        if add_deep_thought_prompt:
            reasoning_prompt = get_deep_thought_prompt()
            # 确保将推理提示添加到最新用户消息的内容中，以避免生成额外的用户消息
            if messages_for_llm and messages_for_llm[-1]['role'] == 'user':
                messages_for_llm[-1]['content'] += "\n\n" + reasoning_prompt
            else:
                # 理论上不应该走到这里，但作为安全措施添加
                messages_for_llm.append({"role": "user", "content": reasoning_prompt})
            logging.info("深度思考提示信息已添加到消息中。")

        # 调用模型生成回复
        logging.info(f"调用模型: {MODEL_ID}，温度: {effective_temperature}，深度思考模式: {deep_thought_mode}")

        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages_for_llm,
            temperature=effective_temperature,
            max_tokens=2000 if deep_thought_mode != "off" else 1000  # 深度思考时使用更多的 token
        )

        full_response_text = completion.choices[0].message.content.strip()  # 清除响应的空格
        ai_message, ai_reasoning_content = "", ""

        # 解析思考过程和最终答案
        if deep_thought_mode != "off":
            thought_start_tag = "[THOUGHT_PROCESS_START]"
            thought_end_tag = "[THOUGHT_PROCESS_END]"
            answer_start_tag = "[FINAL_ANSWER_START]"
            answer_end_tag = "[FINAL_ANSWER_END]"

            thought_start_idx = full_response_text.find(thought_start_tag)
            thought_end_idx = full_response_text.find(thought_end_tag)
            answer_start_idx = full_response_text.find(answer_start_tag)
            answer_end_idx = full_response_text.find(answer_end_tag)

            if thought_start_idx != -1 and thought_end_idx != -1 and thought_start_idx < thought_end_idx:
                ai_reasoning_content = full_response_text[
                                       thought_start_idx + len(thought_start_tag):thought_end_idx
                                       ].strip()
            else:
                logging.warning("未找到思考过程标签或标签顺序错误。")

            if answer_start_idx != -1 and answer_end_idx != -1 and answer_start_idx < answer_end_idx:
                ai_message = full_response_text[
                             answer_start_idx + len(answer_start_tag):answer_end_idx
                             ].strip()
            elif thought_end_idx != -1:
                # 如果没有明确的 [FINAL_ANSWER_START/END]，则将思考过程标签之后的所有内容视为答案
                ai_message = full_response_text[thought_end_idx + len(thought_end_tag):].strip()
            else:
                # 如果未找到任何标签，则将整个响应作为答案，并提示无法解析思考过程
                ai_message = full_response_text.strip()
                ai_reasoning_content = "无法解析思考过程标签或模型未严格遵循格式。"
                logging.warning("无法解析思考过程标签，将完整回复作为答案。")
        else:
            # 如果深度思考模式关闭，则直接将完整响应视为答案，不尝试解析思考过程
            ai_message = full_response_text.strip()
            ai_reasoning_content = "" # 确保在关闭模式下不返回思考过程

        # 如果解析后的答案为空，但完整响应不为空，则使用完整响应作为答案
        if not ai_message and full_response_text:
            ai_message = full_response_text.strip()
            if deep_thought_mode != "off": # 仅当深度思考模式开启时才添加此推理内容
                ai_reasoning_content = "未能成功解析思考过程和回答，使用完整响应。"
                logging.warning("未能解析回答，使用完整响应。")
        
        logging.info(f"AI 回复 (人设: {profile_id}, 温度: {effective_temperature}, 深度思考: {deep_thought_mode}):\n"
                    f"最终回答: {ai_message[:100]}...\n思考过程: {ai_reasoning_content[:100]}...")

        return jsonify({
            "message": ai_message,
            "status": "success",
            "reasoning": ai_reasoning_content  # 将思考过程返回给前端
        })
    
    except requests.exceptions.RequestException as e:
        logging.error(f"API 请求失败: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"API 请求失败: {str(e)}。请检查 API 密钥、网络连接或模型 ID。",
            "reasoning": f"API 连接错误: {str(e)}"
        }), 500
    except KeyError as e:
        logging.error(f"请求数据格式错误: 缺少键 {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"请求数据格式错误: 缺少键 {str(e)}",
            "reasoning": f"请求数据解析错误: 缺少键 {str(e)}"
        }), 400 
    except Exception as e:
        logging.error(f"服务器内部错误: {e}", exc_info=True) 
        return jsonify({
            "status": "error",
            "message": f"服务器内部错误: {str(e)}",
            "reasoning": f"后端处理异常: {str(e)}"
        }), 500



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
