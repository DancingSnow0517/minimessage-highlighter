// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { parseTagTree, TreeNode } from './parser';
import { parseStyle } from './tags';

// 定义JSON文本元素的接口
interface JsonTextElement {
	content: string;
	startPosition: vscode.Position;
	endPosition: vscode.Position;
	startOffset: number;
	endOffset: number;
	path: string[]; // JSON路径，如 ["root", "key", "value"]
}

// 定义TOML文本元素的接口
interface TomlTextElement {
	content: string;
	startPosition: vscode.Position;
	endPosition: vscode.Position;
	startOffset: number;
	endOffset: number;
	path: string[]; // TOML路径，如 ["section", "key"]
}

// 定义YAML文本元素的接口
interface YamlTextElement {
	content: string;
	startPosition: vscode.Position;
	endPosition: vscode.Position;
	startOffset: number;
	endOffset: number;
	path: string[]; // YAML路径，如 ["section", "key"]
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	// 跟踪创建的装饰器，用于清理
	let currentDecorations: vscode.TextEditorDecorationType[] = [];

	// 注册测试命令
	let disposable = vscode.commands.registerCommand('minimessage-highlighter.testJsonParser', () => {
		if (activeEditor) {
			const document = activeEditor.document;
			if (document.languageId === 'json') {
				handleJson(document, activeEditor.selection);
			} else {
				vscode.window.showInformationMessage('当前文件不是JSON格式');
			}
		} else {
			vscode.window.showInformationMessage('没有打开的文件');
		}
	});

	context.subscriptions.push(disposable);

	// 清理所有当前装饰器
	function clearDecorations() {
		currentDecorations.forEach(decoration => {
			decoration.dispose();
		});
		currentDecorations = [];
	}

	// 创建彩虹装饰器
	function createRainbowDecorations(range: vscode.Range, rainbowConfig: { startIndex: number; reverse: boolean }, parentDecoration: vscode.DecorationRenderOptions) {
		const text = activeEditor?.document.getText(range);
		if (!text || !activeEditor) return;

		const { startIndex, reverse } = rainbowConfig;
		const textLength = text.length;
		
		// 为每个字符创建不同颜色的装饰器，继承父级样式
		for (let i = 0; i < textLength; i++) {
			const charIndex = reverse ? textLength - 1 - i : i;
			// 计算色相：从startIndex开始为红色(0°)，然后按字符位置渐变
			const hue = ((i - startIndex) * 360 / textLength) % 360;
			const color = `hsl(${hue}, 100%, 50%)`;
			
			const charRange = new vscode.Range(
				range.start.line,
				range.start.character + charIndex,
				range.start.line,
				range.start.character + charIndex + 1
			);
			
			// 继承父级样式，但覆盖颜色
			const decoration = vscode.window.createTextEditorDecorationType({
				...parentDecoration,
				color: color
			});
			
			currentDecorations.push(decoration);
			activeEditor.setDecorations(decoration, [charRange]);
		}
	}

	// 创建渐变装饰器
	function createGradientDecorations(range: vscode.Range, gradientConfig: { colors: string[]; startColorIndex: number }, parentDecoration: vscode.DecorationRenderOptions) {
		const text = activeEditor?.document.getText(range);
		if (!text || !activeEditor) return;

		const { colors, startColorIndex } = gradientConfig;
		const textLength = text.length;
		const colorCount = colors.length;
		
		// 为每个字符创建不同颜色的装饰器，继承父级样式
		for (let i = 0; i < textLength; i++) {
			const charRange = new vscode.Range(
				range.start.line,
				range.start.character + i,
				range.start.line,
				range.start.character + i + 1
			);
			
			// 计算渐变位置：从startColorIndex开始，在整个文本长度上分布
			const gradientPosition = (i / textLength) * (colorCount - 1);
			const colorIndex = Math.floor(gradientPosition);
			const nextColorIndex = Math.min(colorIndex + 1, colorCount - 1);
			const t = gradientPosition - colorIndex; // 插值因子 (0-1)
			
			// 获取当前颜色和下一个颜色
			const currentColor = colors[(startColorIndex + colorIndex) % colorCount];
			const nextColor = colors[(startColorIndex + nextColorIndex) % colorCount];
			
			// 插值计算颜色
			const interpolatedColor = interpolateColor(currentColor, nextColor, t);
			
			// 继承父级样式，但覆盖颜色
			const decoration = vscode.window.createTextEditorDecorationType({
				...parentDecoration,
				color: interpolatedColor
			});
			
			currentDecorations.push(decoration);
			activeEditor.setDecorations(decoration, [charRange]);
		}
	}

	// 颜色插值函数
	function interpolateColor(color1: string, color2: string, t: number): string {
		// 解析十六进制颜色
		const parseHex = (hex: string) => {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return { r, g, b };
		};
		
		// 转换为十六进制
		const toHex = (r: number, g: number, b: number) => {
			return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
		};
		
		const c1 = parseHex(color1);
		const c2 = parseHex(color2);
		
		// 线性插值
		const r = c1.r + (c2.r - c1.r) * t;
		const g = c1.g + (c2.g - c1.g) * t;
		const b = c1.b + (c2.b - c1.b) * t;
		
		return toHex(r, g, b);
	}

	function updateDecorations() {
		if (!activeEditor) {
			return;
		}

		// 清理之前的装饰器
		clearDecorations();

		const document = activeEditor.document;
		const selection = activeEditor.selection;
		// 判断文本类型是否为json,toml,yaml
		const languageId = document.languageId;
		
		switch (languageId) {
			case 'json':
				handleJson(document, selection);
				break;
			case 'toml':
				handleToml(document, selection);
				break;
			case 'yaml':
				handleYaml(document, selection);
				break;
			default:
				return;
		}
	}

	// 通用的文本元素接口
	interface TextElement {
		content: string;
		startPosition: vscode.Position;
		endPosition: vscode.Position;
		startOffset: number;
		endOffset: number;
		path: string[];
	}

	function parseTagStyle(textElement: TextElement, tagTree: TreeNode[], parentDecoration: vscode.DecorationRenderOptions) {
		const { line, character } = textElement.startPosition;
		for (const node of tagTree) {
			if (node.type === 'text') {
				// 为文本节点创建装饰器，使用当前继承的样式
				const decoration = vscode.window.createTextEditorDecorationType(parentDecoration);
				// 跟踪装饰器用于清理
				currentDecorations.push(decoration);
				// 计算正确的范围：字符串内容不包括引号，所以需要 +1 来跳过开始引号
				const range = new vscode.Range(line, character + 1 + node.startIndex, line, character + 1 + node.endIndex);
				
				// 检查是否有彩虹效果
				if ((parentDecoration as any).rainbow) {
					// 为彩虹效果创建多个装饰器
					createRainbowDecorations(range, (parentDecoration as any).rainbow, parentDecoration);
				}
				// 检查是否有渐变效果
				else if ((parentDecoration as any).gradient) {
					// 为渐变效果创建多个装饰器
					createGradientDecorations(range, (parentDecoration as any).gradient, parentDecoration);
				}
				else {
					activeEditor?.setDecorations(decoration, [range]);
				}
			}
			if (node.type === 'tag') {
				// 创建新的装饰对象，继承父级样式
				let decoration = { ...parentDecoration };
				// 应用当前标签的样式
				decoration = parseStyle(node, decoration);
				// 递归处理子节点，传递当前装饰
				parseTagStyle(textElement, node.children, decoration);
			}
		}
	}

	function handleJson(document: vscode.TextDocument, selection: vscode.Selection) {
		// 获取文本中的所有json TextElement
		const textElements = getJsonTextElements(document);

		for (const element of textElements) {
			const tagTree = parseTagTree(element.content);
			parseTagStyle(element as TextElement, tagTree, {});
		}

		// 输出找到的文本元素信息


		// 可以在这里添加高亮显示逻辑
		// highlightJsonElements(document, textElements);
	}

	/**
	 * 获取JSON文档中的所有文本元素
	 * @param document VS Code文档对象
	 * @returns JSON文本元素数组
	 */
	function getJsonTextElements(document: vscode.TextDocument): JsonTextElement[] {
		const textElements: JsonTextElement[] = [];
		const text = document.getText();

		try {
			// 使用更精确的方法来解析JSON并找到位置
			const elements = parseJsonWithPositions(text, document);
			return elements;
		} catch (error) {
			console.error('Failed to parse JSON:', error);
		}

		return textElements;
	}

	/**
	 * 解析JSON并获取所有文本元素的位置信息
	 * @param text JSON文本
	 * @param document VS Code文档对象
	 * @returns JSON文本元素数组
	 */
	function parseJsonWithPositions(text: string, document: vscode.TextDocument): JsonTextElement[] {
		const elements: JsonTextElement[] = [];
		let index = 0;
		let path: string[] = [];

		// 跳过空白字符
		function skipWhitespace() {
			while (index < text.length && /\s/.test(text[index])) {
				index++;
			}
		}

		// 解析字符串
		function parseString(): string | null {
			if (text[index] !== '"') {
				return null;
			}

			const startIndex = index;
			index++; // 跳过开始的引号
			let result = '';
			let escaped = false;

			while (index < text.length) {
				const char = text[index];

				if (escaped) {
					if (char === 'u') {
						// Unicode转义序列
						if (index + 4 < text.length) {
							const hex = text.substring(index + 1, index + 5);
							if (/^[0-9a-fA-F]{4}$/.test(hex)) {
								result += String.fromCharCode(parseInt(hex, 16));
								index += 4;
							} else {
								throw new Error(`Invalid Unicode escape sequence at position ${index}`);
							}
						} else {
							throw new Error(`Incomplete Unicode escape sequence at position ${index}`);
						}
					} else {
						// 其他转义字符
						const escapeMap: { [key: string]: string } = {
							'"': '"',
							'\\': '\\',
							'/': '/',
							'b': '\b',
							'f': '\f',
							'n': '\n',
							'r': '\r',
							't': '\t'
						};
						result += escapeMap[char] || char;
					}
					escaped = false;
				} else if (char === '\\') {
					escaped = true;
				} else if (char === '"') {
					index++; // 跳过结束引号
					return result;
				} else {
					result += char;
				}
				index++;
			}

			throw new Error(`Unterminated string starting at position ${startIndex}`);
		}

		// 解析对象
		function parseObject(): any {
			if (text[index] !== '{') {
				return null;
			}

			const result: any = {};
			index++; // 跳过开始的 {

			skipWhitespace();

			if (text[index] === '}') {
				index++; // 跳过结束的 }
				return result;
			}

			while (index < text.length) {
				skipWhitespace();

				// 解析键
				const key = parseString();
				if (key === null) {
					throw new Error(`Expected string key at position ${index}`);
				}

				skipWhitespace();

				if (text[index] !== ':') {
					throw new Error(`Expected ':' at position ${index}`);
				}
				index++; // 跳过 :

				skipWhitespace();

				// 解析值
				const currentPath = [...path, key];
				const value = parseValue(currentPath);
				result[key] = value;

				skipWhitespace();

				if (text[index] === '}') {
					index++; // 跳过结束的 }
					break;
				} else if (text[index] === ',') {
					index++; // 跳过逗号
				} else {
					throw new Error(`Expected ',' or '}' at position ${index}`);
				}
			}

			return result;
		}

		// 解析数组
		function parseArray(): any {
			if (text[index] !== '[') {
				return null;
			}

			const result: any[] = [];
			index++; // 跳过开始的 [

			skipWhitespace();

			if (text[index] === ']') {
				index++; // 跳过结束的 ]
				return result;
			}

			let arrayIndex = 0;
			while (index < text.length) {
				skipWhitespace();

				// 解析值
				const currentPath = [...path, arrayIndex.toString()];
				const value = parseValue(currentPath);
				result.push(value);
				arrayIndex++;

				skipWhitespace();

				if (text[index] === ']') {
					index++; // 跳过结束的 ]
					break;
				} else if (text[index] === ',') {
					index++; // 跳过逗号
				} else {
					throw new Error(`Expected ',' or ']' at position ${index}`);
				}
			}

			return result;
		}

		// 解析值
		function parseValue(currentPath: string[]): any {
			skipWhitespace();

			const startIndex = index;

			if (text[index] === '"') {
				// 字符串值
				const stringStartIndex = index;
				const value = parseString();
				const stringEndIndex = index;

				// 创建文本元素
				const startPosition = document.positionAt(stringStartIndex);
				const endPosition = document.positionAt(stringEndIndex);

				elements.push({
					content: value!,
					startPosition,
					endPosition,
					startOffset: stringStartIndex,
					endOffset: stringEndIndex,
					path: currentPath
				});

				return value;
			} else if (text[index] === '{') {
				// 对象值
				const originalPath = path;
				path = currentPath;
				const result = parseObject();
				path = originalPath;
				return result;
			} else if (text[index] === '[') {
				// 数组值
				const originalPath = path;
				path = currentPath;
				const result = parseArray();
				path = originalPath;
				return result;
			} else if (text[index] === 't' && text.substring(index, index + 4) === 'true') {
				// true值
				index += 4;
				return true;
			} else if (text[index] === 'f' && text.substring(index, index + 5) === 'false') {
				// false值
				index += 5;
				return false;
			} else if (text[index] === 'n' && text.substring(index, index + 4) === 'null') {
				// null值
				index += 4;
				return null;
			} else if (/[-0-9]/.test(text[index])) {
				// 数字值
				const numberStartIndex = index;
				while (index < text.length && /[-0-9.eE]/.test(text[index])) {
					index++;
				}
				const numberStr = text.substring(numberStartIndex, index);
				return parseFloat(numberStr);
			} else {
				throw new Error(`Unexpected character at position ${index}: ${text[index]}`);
			}
		}

		// 开始解析
		skipWhitespace();
		parseValue([]);

		return elements;
	}



	/**
	 * 高亮显示JSON文本元素（可选功能）
	 * @param document VS Code文档对象
	 * @param elements JSON文本元素数组
	 */
	function highlightJsonElements(document: vscode.TextDocument, elements: JsonTextElement[]): void {
		// 这里可以添加高亮显示逻辑
		// 例如创建装饰器来高亮显示找到的文本元素
	}

	function handleToml(document: vscode.TextDocument, selection: vscode.Selection) {
		// 获取文本中的所有TOML TextElement
		const textElements = getTomlTextElements(document);

		for (const element of textElements) {
			const tagTree = parseTagTree(element.content);
			parseTagStyle(element as TextElement, tagTree, {});
		}

		// 输出找到的文本元素信息

	}

	function handleYaml(document: vscode.TextDocument, selection: vscode.Selection) {
		// 获取文本中的所有YAML TextElement
		const textElements = getYamlTextElements(document);

		for (const element of textElements) {
			const tagTree = parseTagTree(element.content);
			parseTagStyle(element as TextElement, tagTree, {});
		}

		// 输出找到的文本元素信息

	}

	/**
	 * 获取TOML文档中的所有文本元素
	 * @param document VS Code文档对象
	 * @returns TOML文本元素数组
	 */
	function getTomlTextElements(document: vscode.TextDocument): TomlTextElement[] {
		const textElements: TomlTextElement[] = [];
		const text = document.getText();

		try {
			const elements = parseTomlWithPositions(text, document);
			return elements;
		} catch (error) {
			console.error('Failed to parse TOML:', error);
		}

		return textElements;
	}

	/**
	 * 获取YAML文档中的所有文本元素
	 * @param document VS Code文档对象
	 * @returns YAML文本元素数组
	 */
	function getYamlTextElements(document: vscode.TextDocument): YamlTextElement[] {
		const textElements: YamlTextElement[] = [];
		const text = document.getText();

		try {
			const elements = parseYamlWithPositions(text, document);
			return elements;
		} catch (error) {
			console.error('Failed to parse YAML:', error);
		}

		return textElements;
	}

	/**
	 * 解析TOML并获取所有文本元素的位置信息
	 * @param text TOML文本
	 * @param document VS Code文档对象
	 * @returns TOML文本元素数组
	 */
	function parseTomlWithPositions(text: string, document: vscode.TextDocument): TomlTextElement[] {
		const elements: TomlTextElement[] = [];
		let index = 0;
		let path: string[] = [];
		let currentSection: string[] = [];

		// 跳过空白字符
		function skipWhitespace() {
			while (index < text.length && /\s/.test(text[index])) {
				index++;
			}
		}

		// 跳过注释
		function skipComment() {
			if (text[index] === '#') {
				while (index < text.length && text[index] !== '\n') {
					index++;
				}
			}
		}

		// 解析字符串
		function parseString(): string | null {
			const startIndex = index;
			let quoteChar = '';
			
			// 检查引号类型
			if (text[index] === '"') {
				quoteChar = '"';
			} else if (text[index] === "'") {
				quoteChar = "'";
			} else {
				return null;
			}

			index++; // 跳过开始引号
			let result = '';
			let escaped = false;

			while (index < text.length) {
				const char = text[index];

				if (escaped) {
					if (char === 'u') {
						// Unicode转义序列
						if (index + 4 < text.length) {
							const hex = text.substring(index + 1, index + 5);
							if (/^[0-9a-fA-F]{4}$/.test(hex)) {
								result += String.fromCharCode(parseInt(hex, 16));
								index += 4;
							} else {
								throw new Error(`Invalid Unicode escape sequence at position ${index}`);
							}
						} else {
							throw new Error(`Incomplete Unicode escape sequence at position ${index}`);
						}
					} else {
						// 其他转义字符
						const escapeMap: { [key: string]: string } = {
							'"': '"',
							"'": "'",
							'\\': '\\',
							'b': '\b',
							't': '\t',
							'n': '\n',
							'f': '\f',
							'r': '\r'
						};
						result += escapeMap[char] || char;
					}
					escaped = false;
				} else if (char === '\\') {
					escaped = true;
				} else if (char === quoteChar) {
					index++; // 跳过结束引号
					return result;
				} else {
					result += char;
				}
				index++;
			}

			throw new Error(`Unterminated string starting at position ${startIndex}`);
		}

		// 解析多行字符串
		function parseMultilineString(): string | null {
			if (text.substring(index, index + 3) !== '"""' && text.substring(index, index + 3) !== "'''") {
				return null;
			}

			const quoteType = text[index];
			const startIndex = index;
			index += 3; // 跳过开始引号
			
			let result = '';
			let firstLine = true;

			while (index < text.length) {
				if (text.substring(index, index + 3) === quoteType + quoteType + quoteType) {
					index += 3;
					return result;
				}

				if (firstLine && text[index] === '\n') {
					// 跳过第一行的换行符
					index++;
					firstLine = false;
					continue;
				}

				result += text[index];
				index++;
			}

			throw new Error(`Unterminated multiline string starting at position ${startIndex}`);
		}

		// 解析键名
		function parseKey(): string | null {
			skipWhitespace();
			
			if (text[index] === '"' || text[index] === "'") {
				return parseString();
			}

			// 解析裸键名
			const startIndex = index;
			while (index < text.length && /[a-zA-Z0-9_-]/.test(text[index])) {
				index++;
			}
			
			if (index > startIndex) {
				return text.substring(startIndex, index);
			}

			return null;
		}

		// 解析值
		function parseValue(currentPath: string[]): any {
			skipWhitespace();

			const startIndex = index;

			if (text[index] === '"' || text[index] === "'") {
				// 字符串值
				const value = parseString();
				const endIndex = index;

				// 创建文本元素 - 包括引号的位置
				const startPosition = document.positionAt(startIndex);
				const endPosition = document.positionAt(endIndex);

				elements.push({
					content: value!,
					startPosition,
					endPosition,
					startOffset: startIndex,
					endOffset: endIndex,
					path: currentPath
				});

				return value;
			} else if (text.substring(index, index + 3) === '"""' || text.substring(index, index + 3) === "'''") {
				// 多行字符串值
				const value = parseMultilineString();
				const endIndex = index;

				// 创建文本元素 - 包括引号的位置
				const startPosition = document.positionAt(startIndex);
				const endPosition = document.positionAt(endIndex);

				elements.push({
					content: value!,
					startPosition,
					endPosition,
					startOffset: startIndex,
					endOffset: endIndex,
					path: currentPath
				});

				return value;
			} else if (text[index] === '[') {
				// 数组值
				const arrayStartIndex = index;
				index++; // 跳过 [
				skipWhitespace();

				const result: any[] = [];
				let arrayIndex = 0;

				while (index < text.length && text[index] !== ']') {
					skipWhitespace();
					skipComment();

					if (text[index] === ']') break;

					const currentPath = [...path, arrayIndex.toString()];
					const value = parseValue(currentPath);
					result.push(value);
					arrayIndex++;

					skipWhitespace();
					skipComment();

					if (text[index] === ',') {
						index++;
					} else if (text[index] !== ']') {
						throw new Error(`Expected ',' or ']' at position ${index}`);
					}
				}

				if (text[index] === ']') {
					index++;
				}

				return result;
			} else if (text[index] === '{') {
				// 内联表
				const tableStartIndex = index;
				index++; // 跳过 {
				skipWhitespace();

				const result: any = {};

				while (index < text.length && text[index] !== '}') {
					skipWhitespace();

					const key = parseKey();
					if (!key) {
						throw new Error(`Expected key at position ${index}`);
					}

					skipWhitespace();

					if (text[index] !== '=') {
						throw new Error(`Expected '=' at position ${index}`);
					}
					index++; // 跳过 =

					const currentPath = [...path, key];
					const value = parseValue(currentPath);
					result[key] = value;

					skipWhitespace();

					if (text[index] === ',') {
						index++;
					} else if (text[index] !== '}') {
						throw new Error(`Expected ',' or '}' at position ${index}`);
					}
				}

				if (text[index] === '}') {
					index++;
				}

				return result;
			} else if (/[-0-9]/.test(text[index])) {
				// 数字值
				const numberStartIndex = index;
				while (index < text.length && /[-0-9.eE]/.test(text[index])) {
					index++;
				}
				const numberStr = text.substring(numberStartIndex, index);
				return parseFloat(numberStr);
			} else if (text[index] === 't' && text.substring(index, index + 4) === 'true') {
				index += 4;
				return true;
			} else if (text[index] === 'f' && text.substring(index, index + 5) === 'false') {
				index += 5;
				return false;
			} else {
				throw new Error(`Unexpected character at position ${index}: ${text[index]}`);
			}
		}

		// 解析节标题
		function parseSectionHeader(): string[] | null {
			if (text[index] !== '[') {
				return null;
			}

			const startIndex = index;
			index++; // 跳过 [

			// 检查是否是数组节
			const isArray = text[index] === '[';
			if (isArray) {
				index++;
			}

			skipWhitespace();

			const section: string[] = [];
			let currentPart = '';

			// 解析节标题内容，直到遇到结束的 ]
			while (index < text.length && text[index] !== ']') {
				if (text[index] === '.') {
					if (currentPart) {
						section.push(currentPart.trim());
						currentPart = '';
					}
				} else if (text[index] === '"' || text[index] === "'") {
					// 直接解析引号内容，不使用parseString()函数
					const quoteChar = text[index];
					index++; // 跳过开始引号
					let quotedPart = '';
					
					while (index < text.length && text[index] !== quoteChar) {
						if (text[index] === '\\') {
							index++; // 跳过转义字符
							if (index < text.length) {
								quotedPart += text[index];
								index++;
							}
						} else {
							quotedPart += text[index];
							index++;
						}
					}
					
					if (text[index] === quoteChar) {
						index++; // 跳过结束引号
						section.push(quotedPart);
					} else {
						// 没有找到结束引号，这不是一个有效的节标题
						return null;
					}
				} else {
					currentPart += text[index];
					index++;
				}
			}

			if (currentPart) {
				section.push(currentPart.trim());
			}

			// 确保找到了结束的 ]
			if (text[index] === ']') {
				index++; // 跳过结束的 ]
				if (isArray && text[index] === ']') {
					index++; // 跳过数组节的第二个 ]
				}
				return section;
			} else {
				// 没有找到结束的 ]，这不是一个有效的节标题
				return null;
			}
		}

		// 主解析循环
		while (index < text.length) {
			skipWhitespace();
			skipComment();

			if (index >= text.length) break;

			// 检查是否是节标题
			if (text[index] === '[') {
				const section = parseSectionHeader();
				if (section) {
					currentSection = section;
					path = [...currentSection];
					continue;
				}
			}

			// 解析键值对
			const key = parseKey();
			if (key) {
				skipWhitespace();

				if (text[index] !== '=') {
					throw new Error(`Expected '=' at position ${index}`);
				}
				index++; // 跳过 =

				const currentPath = [...path, key];
				parseValue(currentPath);
			} else {
				index++;
			}
		}

		return elements;
	}

	/**
	 * 解析YAML并获取所有文本元素的位置信息
	 * @param text YAML文本
	 * @param document VS Code文档对象
	 * @returns YAML文本元素数组
	 */
	function parseYamlWithPositions(text: string, document: vscode.TextDocument): YamlTextElement[] {
		const elements: YamlTextElement[] = [];
		const lines = text.split('\n');
		let path: string[] = [];
		let index = 0;
		let indentStack: number[] = [0]; // 用于跟踪缩进级别
		let arrayIndexes: { [key: string]: number } = {}; // 跟踪每个数组的当前索引

		// 计算当前字符在文档中的位置
		function getDocumentPosition(lineIndex: number, charIndex: number): vscode.Position {
			let offset = 0;
			for (let i = 0; i < lineIndex; i++) {
				offset += lines[i].length + 1; // +1 for newline
			}
			offset += charIndex;
			const position = document.positionAt(offset);
			if (!position) {
				throw new Error(`Invalid position at line ${lineIndex}, char ${charIndex}`);
			}
			return position;
		}

		// 解析字符串值
		function parseYamlString(line: string, lineIndex: number, startChar: number): string | null {
			const quoteChar = line[startChar];
			if (quoteChar !== '"' && quoteChar !== "'") {
				return null;
			}

			const startIndex = startChar;
			let result = '';
			let charIndex = startChar + 1;
			let escaped = false;

			while (charIndex < line.length) {
				const char = line[charIndex];

				if (escaped) {
					if (char === 'u') {
						// Unicode转义序列
						if (charIndex + 4 < line.length) {
							const hex = line.substring(charIndex + 1, charIndex + 5);
							if (/^[0-9a-fA-F]{4}$/.test(hex)) {
								result += String.fromCharCode(parseInt(hex, 16));
								charIndex += 4;
							} else {
								throw new Error(`Invalid Unicode escape sequence at position ${charIndex}`);
							}
						} else {
							throw new Error(`Incomplete Unicode escape sequence at position ${charIndex}`);
						}
					} else {
						// 其他转义字符
						const escapeMap: { [key: string]: string } = {
							'"': '"',
							"'": "'",
							'\\': '\\',
							'b': '\b',
							't': '\t',
							'n': '\n',
							'f': '\f',
							'r': '\r'
						};
						result += escapeMap[char] || char;
					}
					escaped = false;
				} else if (char === '\\') {
					escaped = true;
				} else if (char === quoteChar) {
					charIndex++;
					return result;
				} else {
					result += char;
				}
				charIndex++;
			}

			throw new Error(`Unterminated string starting at position ${startIndex}`);
		}

		// 解析多行字符串
		function parseYamlMultilineString(lineIndex: number): string | null {
			if (lines[lineIndex].trim() !== '|' && lines[lineIndex].trim() !== '>') {
				return null;
			}

			const startLine = lineIndex;
			const isLiteral = lines[lineIndex].trim() === '|';
			let result = '';
			lineIndex++;

			while (lineIndex < lines.length) {
				const line = lines[lineIndex];
				const trimmedLine = line.trim();

				// 检查是否是新的缩进级别
				const currentIndent = line.match(/^\s*/)?.[0] || '';
				const startIndent = lines[startLine].match(/^\s*/)?.[0] || '';
				if (trimmedLine && currentIndent.length <= startIndent.length) {
					break;
				}

				if (trimmedLine) {
					if (isLiteral) {
						result += line.substring(currentIndent.length) + '\n';
					} else {
						result += line.substring(currentIndent.length) + ' ';
					}
				} else {
					result += '\n';
				}

				lineIndex++;
			}

			return result.trim();
		}

		// 解析键值对
		function parseKeyValue(line: string, lineIndex: number): void {
			const colonIndex = line.indexOf(':');
			if (colonIndex === -1) return;

			const key = line.substring(0, colonIndex).trim();
			const value = line.substring(colonIndex + 1).trim();

			if (value) {
				// 检查是否是字符串值
				if (value.startsWith('"') || value.startsWith("'")) {
					const stringValue = parseYamlString(line, lineIndex, colonIndex + 1 + line.substring(colonIndex + 1).indexOf(value[0]));
					if (stringValue !== null) {
						const currentPath = [...path, key];
						// 计算正确的字符串位置，包括引号
						const valueStartIndex = colonIndex + 1 + line.substring(colonIndex + 1).indexOf(value[0]);
						const startPosition = getDocumentPosition(lineIndex, valueStartIndex);
						const endPosition = getDocumentPosition(lineIndex, line.length);

						const startOffset = document.offsetAt(startPosition);
						const endOffset = document.offsetAt(endPosition);
						if (startOffset !== undefined && endOffset !== undefined) {
							elements.push({
								content: stringValue,
								startPosition,
								endPosition,
								startOffset,
								endOffset,
								path: currentPath
							});
						}
					}
				}
			} else {
				// 检查下一行是否是多行字符串
				if (lineIndex + 1 < lines.length) {
					const nextLine = lines[lineIndex + 1];
					const multilineValue = parseYamlMultilineString(lineIndex + 1);
					if (multilineValue !== null) {
						const currentPath = [...path, key];
						// 计算多行字符串的位置
						const startPosition = getDocumentPosition(lineIndex + 1, 0);
						const endPosition = getDocumentPosition(lineIndex + 1, nextLine.length);

						const startOffset = document.offsetAt(startPosition);
						const endOffset = document.offsetAt(endPosition);
						if (startOffset !== undefined && endOffset !== undefined) {
							elements.push({
								content: multilineValue,
								startPosition,
								endPosition,
								startOffset,
								endOffset,
								path: currentPath
							});
						}
					}
				}
			}
		}

		// 主解析循环
		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			const trimmedLine = line.trim();

			if (!trimmedLine || trimmedLine.startsWith('#')) {
				continue;
			}

			// 计算当前行的缩进级别
			const currentIndent = line.length - line.trimStart().length;
			
			// 处理缩进变化 - 只在非数组项时处理
			if (!trimmedLine.startsWith('-')) {
				while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
					indentStack.pop();
					path.pop(); // 移除对应的路径元素
				}
				
				// 如果缩进增加，添加到栈中
				if (currentIndent > indentStack[indentStack.length - 1]) {
					indentStack.push(currentIndent);
				}
			}

			// 检查是否是数组项
			if (trimmedLine.startsWith('-')) {
				// 解析数组项
				const arrayItemContent = trimmedLine.substring(1).trim();
				
				// 查找当前数组的父级路径（不包含数组索引的路径）
				let parentPath = [...path];
				for (let i = parentPath.length - 1; i >= 0; i--) {
					if (!isNaN(parseInt(parentPath[i]))) {
						parentPath = parentPath.slice(0, i);
						break;
					}
				}
				const arrayPathKey = parentPath.join('.');
				
				// 获取或初始化当前数组的索引
				if (!arrayIndexes[arrayPathKey]) {
					arrayIndexes[arrayPathKey] = 0;
				} else {
					arrayIndexes[arrayPathKey]++;
				}
				
				// 重置路径到父级路径，然后添加数组索引
				path = [...parentPath, arrayIndexes[arrayPathKey].toString()];
				
				// 如果数组项有内容，处理字符串值
				if (arrayItemContent) {
					let stringValue: string | null = null;
					let startCharIndex = 0;
					
					// 检查是否是带引号的字符串
					if (arrayItemContent.startsWith('"') || arrayItemContent.startsWith("'")) {
						stringValue = parseYamlString(line, lineIndex, line.indexOf(arrayItemContent[0]));
						startCharIndex = line.indexOf(arrayItemContent[0]);
					} else {
						// 处理没有引号的字符串
						stringValue = arrayItemContent;
						startCharIndex = line.indexOf(arrayItemContent);
					}
					
					if (stringValue !== null) {
						const currentPath = [...path];
						
						// 对于没有引号的字符串，位置需要-1
						const positionOffset = (arrayItemContent.startsWith('"') || arrayItemContent.startsWith("'")) ? 0 : -1;
						const startPosition = getDocumentPosition(lineIndex, startCharIndex + positionOffset);
						const endPosition = getDocumentPosition(lineIndex, startCharIndex + stringValue.length + positionOffset);

						const startOffset = document.offsetAt(startPosition);
						const endOffset = document.offsetAt(endPosition);
						if (startOffset !== undefined && endOffset !== undefined) {
							elements.push({
								content: stringValue,
								startPosition,
								endPosition,
								startOffset,
								endOffset,
								path: currentPath
							});
						}
					}
				}
				
				// 检查数组项是否包含属性（如 "- name: value"）
				if (arrayItemContent && arrayItemContent.includes(':')) {
					const colonIndex = arrayItemContent.indexOf(':');
					const key = arrayItemContent.substring(0, colonIndex).trim();
					const value = arrayItemContent.substring(colonIndex + 1).trim();
					
					if (value) {
						let stringValue: string | null = null;
						let startCharIndex = 0;
						
						// 检查是否是带引号的字符串
						if (value.startsWith('"') || value.startsWith("'")) {
							stringValue = parseYamlString(line, lineIndex, line.indexOf(value[0]));
							startCharIndex = line.indexOf(value[0]);
						} else {
							// 处理没有引号的字符串
							stringValue = value;
							// 找到冒号后的第一个非空格字符位置
							const colonIndex = line.indexOf(':');
							startCharIndex = colonIndex + 1;
							while (startCharIndex < line.length && line[startCharIndex] === ' ') {
								startCharIndex++;
							}
						}
						
						if (stringValue !== null) {
							const currentPath = [...path, key];
							
							// 对于没有引号的字符串，位置需要-1
							const positionOffset = (value.startsWith('"') || value.startsWith("'")) ? 0 : -1;
							const startPosition = getDocumentPosition(lineIndex, startCharIndex + positionOffset);
							const endPosition = getDocumentPosition(lineIndex, startCharIndex + stringValue.length + positionOffset);

							const startOffset = document.offsetAt(startPosition);
							const endOffset = document.offsetAt(endPosition);
							if (startOffset !== undefined && endOffset !== undefined) {
								elements.push({
									content: stringValue,
									startPosition,
									endPosition,
									startOffset,
									endOffset,
									path: currentPath
								});
							}
						}
					}
					
					// 更新路径 - 添加属性名
					path = [...path, key];
				}
				// 如果数组项为空（如 "-"），路径已经更新，继续处理下一行的对象属性
			} else if (trimmedLine.includes(':') && !trimmedLine.endsWith(':')) {
				// 处理对象属性（包括数组中的对象属性）
				const colonIndex = trimmedLine.indexOf(':');
				const key = trimmedLine.substring(0, colonIndex).trim();
				const value = trimmedLine.substring(colonIndex + 1).trim();
				
				if (value) {
					let stringValue: string | null = null;
					let startCharIndex = 0;
					
					// 检查是否是带引号的字符串
					if (value.startsWith('"') || value.startsWith("'")) {
						stringValue = parseYamlString(line, lineIndex, line.indexOf(value[0]));
						startCharIndex = line.indexOf(value[0]);
					} else {
						// 处理没有引号的字符串
						stringValue = value;
						// 找到冒号后的第一个非空格字符位置
						const colonIndex = line.indexOf(':');
						startCharIndex = colonIndex + 1;
						while (startCharIndex < line.length && line[startCharIndex] === ' ') {
							startCharIndex++;
						}
					}
					
					if (stringValue !== null) {
						const currentPath = [...path, key];
						
						// 对于没有引号的字符串，位置需要-1
						const positionOffset = (value.startsWith('"') || value.startsWith("'")) ? 0 : -1;
						const startPosition = getDocumentPosition(lineIndex, startCharIndex + positionOffset);
						const endPosition = getDocumentPosition(lineIndex, startCharIndex + stringValue.length + positionOffset);

						const startOffset = document.offsetAt(startPosition);
						const endOffset = document.offsetAt(endPosition);
						if (startOffset !== undefined && endOffset !== undefined) {
							elements.push({
								content: stringValue,
								startPosition,
								endPosition,
								startOffset,
								endOffset,
								path: currentPath
							});
						}
					}
				}
				
				// 更新路径 - 添加属性名
				path = [...path, key];
			} else if (trimmedLine.endsWith(':')) {
				// 节标题
				const sectionName = trimmedLine.slice(0, -1).trim();
				path = [...path, sectionName];
			} else {
				// 键值对
				parseKeyValue(line, lineIndex);
			}
		}

		return elements;
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		updateDecorations();
	});

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor?.document) {
			updateDecorations();
		}
	}, null, context.subscriptions);

	// 在扩展激活时立即应用装饰器
	if (activeEditor) {
		updateDecorations();
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
