import * as vscode from 'vscode';
import { TagNode } from "./parser";

// 扩展装饰器类型以支持彩虹和渐变功能
interface ExtendedDecorationRenderOptions extends vscode.DecorationRenderOptions {
    rainbow?: {
        startIndex: number;
        reverse: boolean;
    };
    gradient?: {
        colors: string[];
        startColorIndex: number;
    };
}


const COLOR_TAGS: Map<string, string> = new Map([
    ['black', '#000000'],
    ['dark_blue', '#0000AA'],
    ['dark_green', '#00AA00'],
    ['dark_aqua', '#00AAAA'],
    ['dark_red', '#AA0000'],
    ['dark_purple', '#AA00AA'],
    ['gold', '#FFAA00'],
    ['gray', '#AAAAAA'],
    ['dark_gray', '#555555'],
    ['blue', '#5555FF'],
    ['green', '#55FF55'],
    ['aqua', '#55FFFF'],
    ['red', '#FF5555'],
    ['light_purple', '#FF55FF'],
    ['yellow', '#FFFF55'],
    ['white', '#FFFFFF']
]);



export function parseStyle(tag: TagNode, parentDecoration: vscode.DecorationRenderOptions): ExtendedDecorationRenderOptions {
    let decoration: ExtendedDecorationRenderOptions = {...parentDecoration};
    
    // 处理否定标签（取消样式）
    if (tag.tag.startsWith('!')) {
        const baseTag = tag.tag.substring(1); // 移除 ! 前缀
        
        // 取消加粗样式
        if (baseTag === 'bold' || baseTag === 'b') {
            decoration.fontWeight = 'normal';
        }
        
        // 取消斜体样式
        if (baseTag === 'italic' || baseTag === 'i' || baseTag === 'em') {
            decoration.fontStyle = 'normal';
        }
        
        // 取消下划线样式
        if (baseTag === 'underline' || baseTag === 'u') {
            if (decoration.textDecoration) {
                decoration.textDecoration = decoration.textDecoration.replace(/\bunderline\b/g, '').trim();
                if (!decoration.textDecoration) {
                    decoration.textDecoration = undefined;
                }
            }
        }
        
        // 取消删除线样式
        if (baseTag === 'strikethrough' || baseTag === 'st') {
            if (decoration.textDecoration) {
                decoration.textDecoration = decoration.textDecoration.replace(/\bline-through\b/g, '').trim();
                if (!decoration.textDecoration) {
                    decoration.textDecoration = undefined;
                }
            }
        }
        
        return decoration;
    }
    
    // 处理正常标签
    if (COLOR_TAGS.has(tag.tag)) {
        decoration.color = COLOR_TAGS.get(tag.tag);
    }
    // 检查 tag 是不是 #00ff00 rgb 格式
    if (tag.tag.startsWith('#') && tag.tag.length === 7) {
        decoration.color = tag.tag;
    }
    if (tag.tag === 'color' || tag.tag === 'c' || tag.tag === 'colour') {
        if (tag.args.length === 1) {
            const color = tag.args[0];
            if (color.startsWith('#') && color.length === 7) {
                decoration.color = color;
            }
        }
    }
    if (tag.tag === 'bold' || tag.tag === 'b') {
        decoration.fontWeight = 'bold';
    }
    if (tag.tag === 'italic' || tag.tag === 'i' || tag.tag === 'em') {
        decoration.fontStyle = 'italic';
    }
    // 处理下划线样式
    if (tag.tag === 'underline' || tag.tag === 'u') {
        decoration.textDecoration = decoration.textDecoration || '';
        // 如果已经有删除线，保留删除线并添加下划线
        if (decoration.textDecoration.includes('line-through')) {
            decoration.textDecoration = decoration.textDecoration.replace('line-through', 'line-through underline');
        } else {
            decoration.textDecoration = decoration.textDecoration ? `${decoration.textDecoration} underline` : 'underline';
        }
    }
    // 处理删除线样式
    if (tag.tag === 'strikethrough' || tag.tag === 'st') {
        decoration.textDecoration = decoration.textDecoration || '';
        // 如果已经有下划线，保留下划线并添加删除线
        if (decoration.textDecoration.includes('underline')) {
            decoration.textDecoration = decoration.textDecoration.replace('underline', 'underline line-through');
        } else {
            decoration.textDecoration = decoration.textDecoration ? `${decoration.textDecoration} line-through` : 'line-through';
        }
    }

    if (tag.tag === 'rainbow') {
        // 实现彩虹色渐变
        // 格式: <rainbow> 或 <rainbow:startIndex> 或 <rainbow:!startIndex> (从右到左)
        let startIndex = 0; // 默认从第一个字符开始
        let reverse = false; // 默认从左到右
        
        if (tag.args.length > 0) {
            const arg = tag.args[0];
            if (arg.startsWith('!')) {
                // 从右到左渐变
                reverse = true;
                startIndex = parseInt(arg.substring(1)) || 0;
            } else {
                // 从左到右渐变
                startIndex = parseInt(arg) || 0;
            }
        }
        
        // 设置特殊的彩虹标记，在渲染时处理
        decoration.rainbow = {
            startIndex,
            reverse
        };
    }

    if (tag.tag === 'gradient') {
        // 实现渐变色标签
        // 格式: <gradient:red:blue> 或 <gradient:#FF0000:#0000FF:1> (从第2个颜色开始)
        if (tag.args.length >= 2) {
            const colors: string[] = [];
            let startColorIndex = 0;
            
            // 解析颜色参数
            for (let i = 0; i < tag.args.length; i++) {
                const arg = tag.args[i];
                
                // 检查最后一个参数是否为数字
                if (i === tag.args.length - 1 && !isNaN(parseInt(arg))) {
                    startColorIndex = parseInt(arg);
                    break;
                }
                
                // 解析颜色
                let color: string | undefined;
                
                // 检查是否是预定义的颜色标签
                if (COLOR_TAGS.has(arg)) {
                    color = COLOR_TAGS.get(arg);
                }
                // 检查是否是十六进制颜色
                else if (arg.startsWith('#') && arg.length === 7) {
                    color = arg;
                }
                
                if (color) {
                    colors.push(color);
                }
            }
            
            // 设置渐变标记，在渲染时处理
            if (colors.length >= 2) {
                decoration.gradient = {
                    colors,
                    startColorIndex
                };
            }
        }
    }

    if(tag.tag === 'transition') {
        
    }

    return decoration;
}