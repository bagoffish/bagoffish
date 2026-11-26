import test from "node:test";
import assert from "node:assert/strict";
import { parseForumUserPage, safeForumPath, htmlToText } from "./forumparser.js";

const fixture = `
<html><body>
<h1>Posts by builderman</h1>
<table>
  <tr><th>Post</th><th>Forum</th><th>Date</th></tr>
  <tr>
    <td>
      <div class="Topic"><a href="/forum/100000229/1">Welcome to &amp; the forum!</a></div>
      <div class="Body">Hello <b>world</b><br>Second line<div class="Quote">nested <div>deep</div> quote</div>end</div>
    </td>
    <td><a href="/forums/32">Off Topic</a></td>
    <td>7/24/2009 7:27:01 PM</td>
  </tr>
  <tr>
    <td>
      <div class='Topic Bold'>Untitled thread</div>
      <div class="Body Small">Just text &#39;quoted&#39;</div>
    </td>
    <td><a href="/forums/13">Scripting Helpers</a></td>
    <td>2012-03-04</td>
  </tr>
</table>
<a class="Back Link-Disabled" href="#">Back</a>
<a href="/users/156/asc?page=2&amp;x=1" class="Forward Link-Enabled">Next</a>
</body></html>`;

test("parses posts, nested bodies, metadata and next cursor", () => {
  const { posts, next } = parseForumUserPage(fixture);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Welcome to & the forum!");
  assert.equal(posts[0].threadId, "100000229");
  assert.equal(posts[0].threadUrl, "https://archive.froast.io/forum/100000229/1");
  assert.equal(posts[0].forum, "Off Topic");
  assert.equal(posts[0].date, "7/24/2009 7:27:01 PM");
  assert.match(posts[0].body, /Hello world\nSecond line/);
  assert.match(posts[0].body, /deep/);
  assert.match(posts[0].body, /end$/);
  assert.equal(posts[1].title, "Untitled thread");
  assert.equal(posts[1].body, "Just text 'quoted'");
  assert.equal(posts[1].forum, "Scripting Helpers");
  assert.equal(posts[1].date, "2012-03-04");
  assert.equal(posts[1].threadId, "");
  assert.equal(next, "/users/156/asc?page=2&x=1");
});

test("dates are found when table cells are adjacent", () => {
  const html = '<table><tr><td><div class="Topic"><a href="/forum/5/1">Hi</a></div><div class="Body">x</div></td><td><a href="/forums/32">Off Topic</a></td><td>1/2/2010 3:04 PM</td></tr></table>';
  const { posts } = parseForumUserPage(html);
  assert.equal(posts[0].date, "1/2/2010 3:04 PM");
  assert.equal(posts[0].forum, "Off Topic");
});

test("empty or unrelated pages produce no posts", () => {
  assert.deepEqual(parseForumUserPage("<html>nothing</html>"), { posts: [], next: "" });
  assert.deepEqual(parseForumUserPage(""), { posts: [], next: "" });
});

test("cursor paths stay on the requested user's archive listing", () => {
  assert.equal(safeForumPath("156", ""), "/users/156");
  assert.equal(safeForumPath("156", "/users/156/asc?page=2&x=1"), "/users/156/asc?page=2&x=1");
  assert.equal(safeForumPath("156", "https://archive.froast.io/users/156/2"), "/users/156/2");
  assert.equal(safeForumPath("156", "/users/1567"), "");
  assert.equal(safeForumPath("156", "/forum/1"), "");
  assert.equal(safeForumPath("156", "https://evil.example/users/156"), "");
  assert.equal(safeForumPath("156", "//evil.example/users/156"), "");
  assert.equal(safeForumPath("abc", ""), "");
});

test("htmlToText strips scripts and decodes entities", () => {
  assert.equal(htmlToText("<script>x()</script>a&nbsp;&lt;b&gt;&#x41;"), "a <b>A");
});
