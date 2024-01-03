async function processLink(event) {
  event.preventDefault();

  const validationResult = document.getElementById('validationResult');
  validationResult.innerHTML = "";

  url = getAPILink(document.getElementById('urlInput').value);
  if (url === null) {
    validationResult.innerHTML = '<p class="text-danger">Invalid Twitter Link</p>';
    return;
  }

  showSpinner();

  try {
    const tweet = await fetchTweet(url);
    if (tweet === null) {
      validationResult.innerHTML = '<p class="text-danger">Unable to fetch the tweet</p>';
    } else {
      await archive(tweet);
    }
  } catch(error) {
    console.error("Unable to fetch the tweet: ", error);
  } finally {
    hideSpinner();
  }
}

async function archive(tweet) {
  const files = await downloadMultipleFiles(tweet);
  downloadFilename = tweet.id + ".zip";
  await zip(files, downloadFilename);
}

function getAPILink(url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (anchor.hostname === "x.com" || anchor.hostname === "twitter.com") {
    return "https://api.fxtwitter.com" + anchor.pathname + "/en"
  }
  return null
}

async function fetchTweet(url) {
  try {
    const response = await fetch(url);
    const payload = await response.json();
    return payload.tweet;
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
  return null;
}

async function download(link) {
  try {
    const response = await fetch(link);
    blob = await response.blob();
    if (blob !== null) {
      return { name: encodeURIComponent(link.split("?")[0]), content: blob }
    }
  } catch (error) {
    console.error('Error downloading file:', error.message);
  }
  return null;
}

async function downloadMultipleFiles(tweet) {
  let files = [
    { name: tweet.id + ".json", content: JSON.stringify(tweet, null, 2) },
    { name: tweet.id + ".txt",  content: tweet.text }
  ];

  if (tweet.lang !== "en" && tweet.translation) {
    files.push({ name: tweet.id + "-en.txt", content: tweet.translation.text })
  }

  files.push(await download(tweet.author.avatar_url))
  const allMedia = tweet.media && tweet.media.all
  for (const media of (allMedia ?? [])) {
    files.push(await download(media.url))
    if (media.type === "video") {
      files.push(await download(media.thumbnail_url))
    }
  }

  return files
}

async function zip(files, downloadFilename) {
  if (files.length == 0) {
    return
  }

  const zip = new JSZip();

  files
  .filter(file => file !== null && file !== undefined)
  .forEach(file => {
    zip.file(file.name, file.content);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const url = window.URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function showSpinner() {
  const spinnerContainer = document.getElementById('spinner-container');
  spinnerContainer.style.display = 'flex';
}

function hideSpinner() {
  const spinnerContainer = document.getElementById('spinner-container');
  spinnerContainer.style.display = 'none';
}
