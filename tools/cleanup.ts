import * as fs from 'fs';
import * as path from 'path';

const deleteFolderRecursive = (folder: string) => {
	if (fs.existsSync(folder)) {
		fs.readdirSync(folder).forEach((file) => {
			const curPath = path.join(folder, file);
			if (fs.lstatSync(curPath).isDirectory()) {
				deleteFolderRecursive(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(folder);
	}
};

const folder = process.argv.slice(2)[0];

if (folder) {
	deleteFolderRecursive(path.join(__dirname, '../dist', folder));
} else {
	deleteFolderRecursive(path.join(__dirname, '../dist/cjs'));
	deleteFolderRecursive(path.join(__dirname, '../dist/esm'));
	deleteFolderRecursive(path.join(__dirname, '../dist/umd'));
	deleteFolderRecursive(path.join(__dirname, '../dist/types'));
}
