if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const app = express();
const path = require('path');
const ejsMate = require('ejs-mate');
const Twitter = require('twitter');
const axios = require('axios');
const moment = require('moment');
moment.relativeTimeThreshold('s', 40);
moment.relativeTimeThreshold('ss', null);

const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    bearer_token: process.env.TWITTER_BEARER_TOKEN
})


app.set('view engine', 'ejs')
app.engine('ejs', ejsMate);
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.render('home');
})

app.get('/search', (req, res) => {
    res.render('search')
})

app.post('/search', async (req, res) => {
    const { q, model, retweets, replies, type, max_id } = req.body;
    const searchOptions = {
        q: `"${q}" ${retweets ? '' : '-filter:retweets'} ${replies ? '' : '-filter:replies'}`,
        tweet_mode: 'extended',
        count: 100,
        result_type: type,
        lang: 'en'
    }
    if (max_id) searchOptions.max_id = max_id;
    const result = await client.get('search/tweets', searchOptions)
    console.log("GOT TWEETS!");
    const nextResultsParams = new URLSearchParams(result.search_metadata.next_results);
    const next_max_id = nextResultsParams.get('max_id');
    const texts = result.statuses.map(status => status.full_text)
    const { data: predictions } = await axios.post('http://0.0.0.0:1337/analyze_sentiment', { texts, model });
    const tweets = result.statuses.map((s, i) => {
        return {
            username: s.user.screen_name,
            img: s.user.profile_image_url_https,
            text: s.full_text,
            time: moment.utc(s.created_at, 'ddd MMM DD hh:mm:ss Z YYYY').fromNow(),
            prediction: predictions[i]
        }
    })
    res.send({ tweets, max_id: next_max_id })
})


app.get('/analyze', (req, res) => {
    res.render('analyze');
})

app.post('/analyze', async (req, res) => {
    const { texts, model } = req.body;
    const { data } = await axios.post('http://0.0.0.0:1337/analyze_sentiment', { texts, model })
    res.send({ result: data })
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`listening on port ${port}...`);
})

