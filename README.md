# gtd-scripts

Scripts for getting things done.

The translate-json node script is simple. It takes an input .json file, a comma separated list of language codes supported by [Google Translate](https://ctrlq.org/code/19899-google-translate-languages), and an optional api key.

## Usage with an API Key

node translate-json fixtures/translate-json/en.json fr,et,nl,vi AIzaSyB2xgBmonmkUB_kZGljvK6GISrfVIKe64E

node index.js en fr,et,nl,vi AIzaSyB2xgBmonmkUB_kZGljvK6GISrfVIKe64E

## Usage without an API Key

node translate-json fixtures/translate-json/en.json km AIzaSyB2xgBmonmkUB_kZGljvK6GISrfVIKe64E
node index.js en ja,ko,zh-CN,th,id,km,vi AIzaSyB2xgBmonmkUB_kZGljvK6GISrfVIKe64E

This free version will let you batch-translate a file until you start beeing rejected by Google's servers. As this script has caching enabled, it's possible to translate files incrementally. New requests will become available in 2 hours aproximately.

### Future Improvements:

- Specifying output file name and location.
