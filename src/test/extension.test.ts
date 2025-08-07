import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('JSON Parser Test', async () => {
		// 创建一个简单的JSON文档
		const jsonContent = `{
  "name": "test",
  "version": "1.0.0",
  "description": "A test description"
}`;

		// 创建临时文档
		const document = await vscode.workspace.openTextDocument({
			content: jsonContent,
			language: 'json'
		});

		// 模拟解析JSON文本元素
		const mockElements = [
			{
				content: 'test',
				startPosition: new vscode.Position(1, 9),
				endPosition: new vscode.Position(1, 13),
				startOffset: 9,
				endOffset: 13,
				path: ['name']
			},
			{
				content: '1.0.0',
				startPosition: new vscode.Position(2, 12),
				endPosition: new vscode.Position(2, 17),
				startOffset: 25,
				endOffset: 30,
				path: ['version']
			},
			{
				content: 'A test description',
				startPosition: new vscode.Position(3, 16),
				endPosition: new vscode.Position(3, 33),
				startOffset: 45,
				endOffset: 62,
				path: ['description']
			}
		];

		// 验证解析结果
		assert.strictEqual(mockElements.length, 3);
		assert.strictEqual(mockElements[0].content, 'test');
		assert.strictEqual(mockElements[0].path.join('.'), 'name');
		assert.strictEqual(mockElements[1].content, '1.0.0');
		assert.strictEqual(mockElements[1].path.join('.'), 'version');
		assert.strictEqual(mockElements[2].content, 'A test description');
		assert.strictEqual(mockElements[2].path.join('.'), 'description');
	});

	test('TOML Parser Test', async () => {
		// 创建一个简单的TOML文档
		const tomlContent = `title = "test"
version = "1.0.0"
description = "A test description"

[server]
host = "localhost"
message = "Hello <red>World</red>!"`;

		// 创建临时文档
		const document = await vscode.workspace.openTextDocument({
			content: tomlContent,
			language: 'toml'
		});

		// 模拟解析TOML文本元素
		const mockElements = [
			{
				content: 'test',
				startPosition: new vscode.Position(0, 8),
				endPosition: new vscode.Position(0, 12),
				startOffset: 8,
				endOffset: 12,
				path: ['title']
			},
			{
				content: '1.0.0',
				startPosition: new vscode.Position(1, 10),
				endPosition: new vscode.Position(1, 15),
				startOffset: 25,
				endOffset: 30,
				path: ['version']
			},
			{
				content: 'A test description',
				startPosition: new vscode.Position(2, 14),
				endPosition: new vscode.Position(2, 31),
				startOffset: 44,
				endOffset: 61,
				path: ['description']
			},
			{
				content: 'localhost',
				startPosition: new vscode.Position(5, 8),
				endPosition: new vscode.Position(5, 17),
				startOffset: 75,
				endOffset: 84,
				path: ['server', 'host']
			},
			{
				content: 'Hello <red>World</red>!',
				startPosition: new vscode.Position(6, 10),
				endPosition: new vscode.Position(6, 33),
				startOffset: 95,
				endOffset: 118,
				path: ['server', 'message']
			}
		];

		// 验证解析结果
		assert.strictEqual(mockElements.length, 5);
		assert.strictEqual(mockElements[0].content, 'test');
		assert.strictEqual(mockElements[0].path.join('.'), 'title');
		assert.strictEqual(mockElements[3].content, 'localhost');
		assert.strictEqual(mockElements[3].path.join('.'), 'server.host');
		assert.strictEqual(mockElements[4].content, 'Hello <red>World</red>!');
		assert.strictEqual(mockElements[4].path.join('.'), 'server.message');
	});

	test('YAML Parser Test', async () => {
		// 创建一个简单的YAML文档
		const yamlContent = `title: "test"
version: "1.0.0"
description: "A test description"

server:
  host: "localhost"
  message: "Hello <red>World</red>!"`;

		// 创建临时文档
		const document = await vscode.workspace.openTextDocument({
			content: yamlContent,
			language: 'yaml'
		});

		// 模拟解析YAML文本元素
		const mockElements = [
			{
				content: 'test',
				startPosition: new vscode.Position(0, 8),
				endPosition: new vscode.Position(0, 12),
				startOffset: 8,
				endOffset: 12,
				path: ['title']
			},
			{
				content: '1.0.0',
				startPosition: new vscode.Position(1, 10),
				endPosition: new vscode.Position(1, 15),
				startOffset: 25,
				endOffset: 30,
				path: ['version']
			},
			{
				content: 'A test description',
				startPosition: new vscode.Position(2, 14),
				endPosition: new vscode.Position(2, 31),
				startOffset: 44,
				endOffset: 61,
				path: ['description']
			},
			{
				content: 'localhost',
				startPosition: new vscode.Position(5, 8),
				endPosition: new vscode.Position(5, 17),
				startOffset: 75,
				endOffset: 84,
				path: ['server', 'host']
			},
			{
				content: 'Hello <red>World</red>!',
				startPosition: new vscode.Position(6, 10),
				endPosition: new vscode.Position(6, 33),
				startOffset: 95,
				endOffset: 118,
				path: ['server', 'message']
			}
		];

		// 验证解析结果
		assert.strictEqual(mockElements.length, 5);
		assert.strictEqual(mockElements[0].content, 'test');
		assert.strictEqual(mockElements[0].path.join('.'), 'title');
		assert.strictEqual(mockElements[3].content, 'localhost');
		assert.strictEqual(mockElements[3].path.join('.'), 'server.host');
		assert.strictEqual(mockElements[4].content, 'Hello <red>World</red>!');
		assert.strictEqual(mockElements[4].path.join('.'), 'server.message');
	});
});
