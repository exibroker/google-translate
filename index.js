#!/usr/bin/env node

const fs = require("fs");
const moment = require("moment");
const _ = require("lodash");
const path = require("path");
const agent = require("superagent-promise")(require("superagent"), Promise);
const { translate: translateSourceFiles } = require("google-translate-api-browser");
const { readdir } = require("fs/promises");
var glob = require("glob");
let dictionaryList = {};

//Lang Codes https://ctrlq.org/code/19899-google-translate-languages
let listFile = [];
const getSourceFile = async () => {
  let baseLang = "en";
  console.log(process.argv);
  if (process.argv.length >= 3) {
    baseLang = process.argv[2];
  }
  console.log("base lang: " + baseLang);
  let asObject = true;
  const files = await new Promise((resolve, reject) => {
    glob(path.resolve(`source/**/*`), { strict: false, silent: true, nodir: true }, (err, files) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        if (asObject) {
          let filesObject = files.map((file) => {
            let regexp = /^(.*[\\\/])(.*)$/;
            let match = regexp.exec(file);
            return {
              fullpath: file,
              filepath: match[1],
              filename: match[2],
              dirname: regexp.exec(match[1].substring(0, match[1].length - 1))[2],
              ext: match[2].split(".")[1],
            };
          });
          resolve(filesObject);
        } else {
          resolve(files);
        }
      }
    });
  });
  console.log("total file: " + files.length);
  if (files.length > 0) {
    listFile = files.filter((file) => file.filename.includes(baseLang));
    console.log("total file base lang: " + listFile.length, listFile);
  }
  // if (files.length > 0) {
  //   for (let i = 0; i < files.length; i++) {
  //     const filename = files[i].filename.toString();
  //     if (filename.includes(baseLang)) {
  //       listFile.push(files[i]);
  //     }
  //   }

  // }
};

console.log(process.argv.length, process.argv);
const translate = async () => {
  await getSourceFile();
  if (process.argv.length >= 4 && listFile.length > 0) {
    //Args
    for (let i = 0; i < listFile.length; i++) {
      const sourceFile = listFile[i];
      const inputFile = sourceFile.fullpath;
      const destinationCodes = process.argv[3].split(",");
      const apiKey = process.argv.length > 4 && process.argv[4];
      const apiUrl = _.template(
        "https://www.googleapis.com/language/translate/v2?key=<%= apiKey %>&q=<%= value %>&source=en&target=<%= languageKey %>"
      );
      const transformResponse = (res) => {
        return _.get(JSON.parse(res.text), ["data", "translations", 0, "translatedText"], "");
      };
      const getCache = (languageKey) => {
        try {
          dictionaryList[languageKey] = {};
          let fileContent = fs.readFileSync(`./cache/translateCache-${languageKey}.txt`, "utf-8").split("\n");
          fileContent.map((line) => {
            let cached = line.split("|");
            if (cached[0]) dictionaryList[languageKey][cached[0]] = cached[1];
          });
        } catch (error) { }
      };
      const cachedIndex = (key, value, languageKey) => {
        const line = key + "|" + value + "\n";
        dictionaryList[languageKey][key] = value;
        fs.appendFileSync(`./cache/translateCache-${languageKey}.txt`, line);
        return value;
      };
      function iterLeaves(value, keyChain, accumulator, languageKey) {
        accumulator = accumulator || {};
        keyChain = keyChain || [];
        if (_.isObject(value)) {
          return _.chain(value)
            .reduce((handlers, v, k) => {
              return handlers.concat(iterLeaves(v, keyChain.concat(k), accumulator, languageKey));
            }, [])
            .flattenDeep()
            .value();
        } else {
          if (typeof value !== "string") return value;
          return function () {
            if (!(value in dictionaryList[languageKey])) {
              // console.log(_.template("Translating <%= value %> to <%= languageKey %>")({ value, languageKey }));
              let prom;
              //Translates individual string to language code
              if (apiKey != "") {
                //using apiKey
                prom = agent(
                  "GET",
                  apiUrl({
                    value: encodeURI(value),
                    languageKey,
                    apiKey,
                  })
                ).then(transformResponse);
              } else {
                //using free api key
                prom = translateSourceFiles(value, { to: languageKey });
              }
              return prom
                .then((res) => cachedIndex(value, res, languageKey))
                .catch((err) => console.log(err))
                .then((text) => {
                  //Sets the value in the accumulator
                  _.set(accumulator, keyChain, text?.text);
                  //This needs to be returned to it's eventually written to json
                  return accumulator;
                });
            } else {
              // console.log(value + " cached: " + dictionaryList[languageKey][value]);
              _.set(accumulator, keyChain, dictionaryList[languageKey][value]);
              return accumulator;
            }
          };
        }
      }
      Promise.all(
        _.reduce(
          destinationCodes,
          (sum, languageKey) => {
            const newDir = "./destination/" + sourceFile.dirname;
            if (!fs.existsSync(newDir)) {
              fs.mkdirSync(newDir);
            }
            const fileName = _.template(newDir + "/<%= languageKey %>.json")({
              languageKey,
              timeStamp: moment().unix(),
            });
            console.log("file name: " + fileName);
            //read languageKey Cache.
            getCache(languageKey);
            //Starts with the top level strings
            return sum.concat(
              _.reduce(
                iterLeaves(JSON.parse(fs.readFileSync(path.resolve(inputFile), "utf-8")), undefined, undefined, languageKey),
                (promiseChain, fn) => {
                  return promiseChain.then(fn);
                },
                Promise.resolve()
              )
                .then((payload) => {
                  fs.writeFileSync(fileName, JSON.stringify(payload, null, 4));
                })
                .then(_.partial(console.log, "Successfully translated all nodes, file output at " + fileName))
            );
          },
          []
        )
      ).then(() => {
        // process.exit();
      });
    }
  } else {
    console.error("You must provide an input json file and a comma-separated list of destination language codes.");
  }
};

translate();
