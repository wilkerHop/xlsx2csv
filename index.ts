import xlsx from 'node-xlsx';
import express from 'express';
import bodyParser from 'body-parser';
import busboy from 'connect-busboy';
import csv from 'csvtojson';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(busboy());


app.post('/file', async (req, res) => {
    console.log('pah!');
    if (!req.busboy) {
        return res.status(500).send('fodeu')
    }

    type filesMeta = { data: Buffer, mimeType: string, fieldName: string };
    const files = await new Promise<filesMeta[]>((resolve) => {
        req.pipe(req.busboy);
        const buffs: filesMeta[] = [];

        req.busboy.on('file', (fieldName, fileStream, fileName, encoding, mimeType) => {
            fileStream.on('data', data => {
                const buff = buffs.find(b => b.fieldName === fieldName)

                if (!buff) {
                    return buffs.push({ data, mimeType, fieldName });
                }

                return buff.data += data;
            });
        });


        req.busboy.on('finish', () => {
            resolve(buffs)
        })

    })

    const isExcel = (f: filesMeta) => f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const excels = await Promise.all(files
        .filter(isExcel)
        // loops uploaded excel files
        .map(async excel =>{
            const data = xlsx.parse(excel.data) // parses the xlsx
                .map(({ data }) => // loops each sheet from the file
                    csv().fromString(data.reduce((csv, row) => {
                        // converts the array to string with commas separating the elements
                        csv += `${row}\n`;
                        return csv;
                    }, ''))
                );

            return {...excel, data: (await Promise.all(data))}
        }))
    console.log(excels);


    const csvs = await Promise.all(files
        .filter(f => !isExcel(f))
        .map(async comma => {
            // to follow the sheets pattern from excel, csv data will always be an array of one element
            const data = [await csv().fromString(comma.data.toString('utf-8'))]
            return {...comma, data}
        }))

    const docs = [...excels, ...csvs];

    return res.status(200).send(docs);

})

app.listen(3000, () => console.log('http://localhost:' + 3000))
