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
    document.getElementById('progress-bar').value = 0;
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

async function download(urls) {
  const progressBar = document.getElementById('progress-bar');

  const contentLengths = await Promise.all(urls.map(url => getContentLength(url)));
  const totalContentLength = contentLengths.reduce((total, length) => total + length, 0);

  let totalDownloaded = 0;
  const files = [];

  const downloadPromises = urls.map(async (url, index) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const trackedResponse = trackProgress(response, downloaded => {
        progress = downloaded * contentLengths[index];
        const percentage = ((totalDownloaded + progress) / totalContentLength * 100).toFixed(2);
        progressBar.value = percentage;
      }, contentLengths[index]);

      const blob = await trackedResponse.blob();
      totalDownloaded += contentLengths[index];
      filename = encodeURIComponent(url.split("?")[0])
      files.push({ name: filename, content: blob });
    } catch (error) {
      console.error(`Error during download for ${url}:`, error);
      const validationResult = document.getElementById('validationResult');
      validationResult.innerHTML = "<p class='text-danger'>Some of the files didn't download. Please check the console</p>";
    }
  });

  await Promise.all(downloadPromises);
  progressBar.value = 100;
  return files;
}

async function downloadMultipleFiles(tweet) {
  let files = [
    { name: tweet.id + ".json", content: JSON.stringify(tweet, null, 2) },
    { name: tweet.id + ".txt",  content: tweet.text }
  ];
  if (tweet.lang !== "en" && tweet.translation) {
    files.push({ name: tweet.id + "-en.txt", content: tweet.translation.text })
  }
  const mediaFiles = await download(getMediaLinks(tweet));
  return [...files, ...mediaFiles];
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

async function getContentLength(url) {
  const response = await fetch(url, { method: 'HEAD' });
  if (response.ok) {
    const contentLength = response.headers.get('Content-Length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  } else {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
}

function getMediaLinks(tweet) {
  mediaLinks = [tweet.author.avatar_url]
  const allMedia = tweet.media && tweet.media.all
  for (const media of (allMedia ?? [])) {
    mediaLinks.push(media.url)
    if (media.type === "video") {
      mediaLinks.push(media.thumbnail_url)
    }
  }
  return mediaLinks
}

function trackProgress(response, onProgress, totalContentLength) {
  let downloaded = 0;
  return new Response(
    new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          downloaded += value.byteLength;
          onProgress(downloaded / totalContentLength);
          controller.enqueue(value);
        }
      },
    })
  );
}

function showSpinner() {
  const spinnerContainer = document.getElementById('spinner-container');
  spinnerContainer.style.display = 'flex';

  const progressContainer = document.getElementById('progress-container');
  progressContainer.style.display = 'flex';
}

function hideSpinner() {
  const spinnerContainer = document.getElementById('spinner-container');
  spinnerContainer.style.display = 'none';

  const progressContainer = document.getElementById('progress-container');
  progressContainer.style.display = 'none';
}
