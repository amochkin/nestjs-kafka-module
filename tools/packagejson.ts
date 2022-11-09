import * as fs from 'fs';
import * as path from 'path';
import * as packagejson from '../package.json';

const args = process.argv.slice(2);

for (let i = 0, l = args.length; i < l; i++) {
	if (i % 2 === 0) {
		packagejson[args[i]] = args[i + 1];
	}
}

fs.writeFile(path.join(__dirname, fileName), JSON.stringify(packagejson, null, 2), (err) => {
	if (err) {
		return console.log(err);
	}
	console.log('Writing to ' + fileName);
});
