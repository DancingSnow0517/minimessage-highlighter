export type TreeNode = TextNode | TagNode;

export interface BaseNode {
    startIndex: number;
    endIndex: number;
}

export interface TextNode extends BaseNode {
    type: 'text';
    content: string;
}

export interface TagNode extends BaseNode {
    type: 'tag';
    tag: string;
    args: string[]; // 添加参数数组
    children: TreeNode[];
}

export function parseTagTree(input: string): TreeNode[] {
    const root: TagNode = {
        type: 'tag',
        tag: '__root__',
        args: [],
        children: [],
        startIndex: 0,
        endIndex: input.length
    };

    const stack: TagNode[] = [root]; // 节点栈
    let index = 0; // 当前解析位置
    let textBuffer = ''; // 文本缓冲区
    let textStartIndex = 0; // 文本缓冲区的起始位置

    // 刷新文本缓冲区到当前栈顶节点
    const flushTextBuffer = () => {
        if (textBuffer) {
            const textNode: TextNode = {
                type: 'text',
                content: textBuffer,
                startIndex: textStartIndex,
                endIndex: textStartIndex + textBuffer.length
            };

            const currentParent = stack[stack.length - 1];
            currentParent.children.push(textNode);

            // 更新父节点的结束位置
            currentParent.endIndex = Math.max(currentParent.endIndex, textNode.endIndex);

            textBuffer = '';
        }
    };

    // 处理标签内容
    const parseTagContent = (tag: string) => {
        return tag.trim().replace(/\/$/, ''); // 移除结尾斜杠和空格
    };

    // 解析标签名和参数
    const parseTagNameAndArgs = (tag: string) => {
        const parts = tag.split(':');
        let tagName = parts[0].trim();
        const args = parts.slice(1).map(arg => arg.trim());
        
        // 处理否定标签，如 <!b> 表示取消加粗
        if (tagName.startsWith('!')) {
            tagName = '!' + tagName.substring(1); // 保持 ! 前缀
        }
        
        return { tagName, args };
    };

    // 重置栈到根节点
    const resetStack = () => {
        stack.splice(1, stack.length - 1);
    };

    while (index < input.length) {
        // 尝试匹配开始标签: <tag>
        if (input[index] === '<') {
            const tagStartIndex = index; // 记录标签起始位置
            const tagEnd = input.indexOf('>', index + 1);

            if (tagEnd === -1) {
                // 不完整的标签，当作文本处理
                if (!textBuffer) {
					textStartIndex = index;
				}
                textBuffer += input[index];
                index++;
                continue;
            }

            const tagContent = input.substring(index + 1, tagEnd);
            
            // 检查是否是有效的标签
            // 标签应该以字母开头，或者以/开头（结束标签），或者以!开头（非标签），或者以#开头（十六进制颜色）
            // 允许冒号分隔的参数，参数可以包含字母、数字、#、-、_、!等字符，并且标签内容不应该包含<字符
            const isValidTag = /^[a-zA-Z\/!#][a-zA-Z0-9:#\-_!]*$/.test(tagContent.trim()) && !tagContent.includes('<');
            
            if (!isValidTag) {
                // 不是有效标签，当作文本处理
                if (!textBuffer) {
					textStartIndex = index;
				}
                textBuffer += input[index];
                index++;
                continue;
            }

            const normalizedTag = parseTagContent(tagContent);

            // 处理特殊 reset 标签
            if (normalizedTag.toLowerCase() === 'reset') {
                flushTextBuffer();
                resetStack(); // 重置栈到根节点
                index = tagEnd + 1;
                continue;
            }

            // 处理结束标签: </tag>
            if (input[index + 1] === '/') {
                flushTextBuffer();
                const endTagName = tagContent.trim().replace(/^\//, ''); // 移除开头的斜杠

                // 查找匹配的开始标签（只在当前栈中查找）
                let found = false;
                for (let i = stack.length - 1; i > 0; i--) {
                    // 只匹配标签名，忽略参数
                    if (stack[i].tag === endTagName) {
                        // 设置匹配标签的结束位置
                        stack[i].endIndex = tagEnd + 1;

                        // 更新父节点的结束位置
                        if (i > 0) {
                            stack[i - 1].endIndex = Math.max(stack[i - 1].endIndex, tagEnd + 1);
                        }

                        // 弹出所有子节点
                        stack.splice(i, stack.length - i);
                        found = true;
                        break;
                    }
                }

                // 如果没找到匹配的开始标签，当作普通文本
                if (!found) {
                    const tagText = input.substring(index, tagEnd + 1);
                    if (!textBuffer) {
						textStartIndex = index;
					}
                    textBuffer += tagText;
                }

                index = tagEnd + 1;
                continue;
            }

            // 处理普通开始标签
            flushTextBuffer();
            const { tagName, args } = parseTagNameAndArgs(tagContent);

            // 创建新节点（跳过自闭合标签）
            if (tagName && !tagContent.endsWith('/')) {
                const newNode: TagNode = {
                    type: 'tag',
                    tag: tagName,
                    args: args,
                    children: [],
                    startIndex: tagStartIndex,
                    endIndex: tagEnd + 1 // 初始结束位置为标签结束位置
                };

                // 添加到当前父节点
                const currentParent = stack[stack.length - 1];
                currentParent.children.push(newNode);

                // 更新父节点的结束位置
                currentParent.endIndex = Math.max(currentParent.endIndex, newNode.endIndex);

                // 新节点入栈
                stack.push(newNode);
            }

            index = tagEnd + 1;
            continue;
        }

        // 普通文本内容
        if (!textBuffer) {
            textStartIndex = index; // 记录文本起始位置
        }
        textBuffer += input[index];
        index++;
    }

    // 处理剩余的文本
    flushTextBuffer();

    // 确保所有节点的结束位置正确
    const updateNodeEndIndex = (node: TreeNode) => {
        if (node.type === 'tag') {
            if (node.children.length > 0) {
                const lastChild = node.children[node.children.length - 1];
                node.endIndex = Math.max(node.endIndex, lastChild.endIndex);
            }
            // 递归更新子节点
            node.children.forEach(updateNodeEndIndex);
        }
    };

    root.children.forEach(updateNodeEndIndex);
    return root.children;
}
