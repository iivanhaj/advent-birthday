/**
 * Door 7 · the firefly carousel. The songs, from one playlist.
 *
 * Each song carries a small mood vector, six scores from 0 to 4:
 *
 *   energy    how much it moves
 *   bright    how happy it sounds
 *   romance   how much it is about someone
 *   longing   how much it aches
 *   dreamy    how hazy and soft it is
 *   night     how much it belongs after dark
 *
 * They're hand-scored, by ear. The carousels aren't: mood.ts clusters these
 * vectors, so moving a song is a matter of changing its six digits here.
 * The ID is the part after /track/ in the song's Spotify link.
 */

export const DIMS = ["energy", "bright", "romance", "longing", "dreamy", "night"] as const;
export type Vec = number[];
export type Song = { id: string; title: string; artist: string; mood: Vec };

const RAW = `
3r8RuvgbX9s7ammBn07D3W|Ditto|NewJeans|222332
0GxUJLTF4RanPVwY1YpcZ3|Every Second|Mina Okabe|233121
1nwaAlh4hnKCCV9ZlijNDb|let's run away|Sarah Kang, Orion Song|134131
0F57gwy0G6aqnaMAH1ELSV|Futon|Ūla|122142
7lgvpq4R86aFDc6Q8HJ6Ne|villain|mj apanay|211322
6d4MZsxugjJJ0lNm2AgHpy|flying to the moon|oceanfromtheblue|123143
0T7aTl1t15HKHfwep4nANV|Disco Man|Remi Wolf|441010
26dXOkhzMxLLNaUXt77HQc|always|keshi|112333
08HGey7e94Ez3ZurG1IXTP|next door|Amelia Moore, ASTN|233122
3hxIUxnT27p5WcmjGUXNwx|Shut up My Moms Calling|Hotel Ugly|312423
6BbAFjOCHA1AknMtIu3VjZ|Thru My Hair|¿Téo?|123241
0KyAGiNGUytG5JLxJu4F6l|Pretty Girl|Clairo|222231
1F6IbA7di42uPc3cff8PXV|Flaming Hot Cheetos|Clairo|232131
14p5EKgbPx4U3P1j5JNHeh|Cigarette|offonoff, TABLO, Miso|112334
655YhibeaetlWccj0PYi7W|NOT ME!|jeebanoff|211323
61OJxhoY3Ix50rYVKo8zRK|Can I Call You Tonight?|Dayglow|332222
3kYARoLSAvt86VFZ55BQcq|Head In The Clouds|88rising, Joji|222142
6I0KEvFfWszVJiCy5hum4V|Let's Fall in Love for the Night|FINNEAS|233123
2SSbQoEqPHu6qAgi3pFobY|Alone|Coogie, LEEHI|111323
5OuTSgILh3Mkgj6ir9x9Pz|D.R.E.A.M.|Slom, pH-1|222233
37cXQzQaHR7zMk8G360Vke|Mayday|Crush, JOY|213223
4jPr49jXRJHftXlwTEA2w4|Close to Me|Laica|122232
1sxCFxt2A6kWOm7KpFVVej|True Crime|Epik High, Miso|211324
1tvxzDoafjqs4yvjZW4n2K|my type|brb.|233121
2Qn6WHJrY5Im82Jux8FboH|moonlight|Dhruv|123133
17U7z9PG0iOa7YfR5pzZ6m|Koh|92914|112243
6lXGf0irWo1XWl8acAlzso|fool|frad, Hayne, Milky Day|222231
0KmgJyW4GDgonqsoyx0CZ3|Astronomy|Conan Gray|101442
3rxkB4c34kskp9zKrb4qWh|still|92914|101342
1pvGWSvIXr8PTk8nC4SnXK|Helplessly|Tatiana Manaois|212332
2tmX4T7ODY34NwvQ3DD3MC|Your Existence|Wonstein|213233
0GPJSHYaXh8rZSSJoUMgyl|free love|HONNE|233123
3T03rPwlL8NVk1yIaxeD8U|Off My Face|Justin Bieber|233121
5YAO57ujV1cs5eubzyOL1E|긴 밤|Seori, GIRIBOY|112334
5RqwjQWDwxQ3HTkOfXTrS6|Dive with you|Seori, eaJ|223233
3QyoC6OvQUmpQwQZ18iaTs|Overdrive|Conan Gray|331321
6ZzYETKetIfNUsZUb23jgG|Day 1 ◑|HONNE|332121
3fU8FWNIgHEOepLTidZWyq|Step?|BIBI|322223
2anfFUyh70hWj3sUEGHt3v|11°|Minah|122242
2ZwIO3ufWLFYxtEoam9ydu|My Favourite Clothes|Rini|113232
1Fhb9iJPufNMZSwupsXiRe|beside you|keshi|112333
13pXbQjWqXHRxiB4tcdHnc|Sunset|92914|122142
2XdyebP7KxClMOse2C5iyA|Your Dog Loves You|Colde, Crush|223223
1aRgsJJJMIAaZgiOtGRMl0|2easy|NIve, Heize|223233
3sR1RNcVEDJKUfS8rX20Lx|Love Like That|LambC|233223
2qcAEHuRQRtnmMMroqpgdB|us|punchnello, Meenoi|223233
4AHNi316rl3KI3hKIsdxZe|Restless|BIBI|211324
2Q3QRjA8MjzqpFaIkFludb|right here|keshi|113333
05JtBVWRtSzqLoj7jj30kn|(Can We Be Friends?)|Conan Gray|112332
2IgbYlOlFpiSFYnsqB39lM|Jasmine|DPR LIVE|223234
24iWUKHLXE4ZDkAj0GK4kt|Fall In Love Alone|Stacey Ryan|321321
65FftemJ1DbbZ45DUfHJXE|OMG|NewJeans|432120
6fBiLOkPcQ3iFUpmIv88fQ|sure thing (sped up)|accelerate, creamy|332122
6dgUya35uo964z7GZXM07g|Nonsense|Sabrina Carpenter|441110
0RUTnY2B3s05fZuCHsNaUP|Alien|Sabrina Carpenter, Jonas Blue|331121
349Wc5mDu52d4Uv8Eg9WZv|Indigo|88rising, NIKI|223233
7uo2L5FAja3pWIBa3HJVeC|could you love me while i hate myself|Zeph|101432
7fXYFuCTmNrYRGwEUUf5iz|Die Right Here|david hugo|201422
71sBnFT8QL9AsYxIduK9YR|lay it down|Steelix|223234
72jbDTw1piOOj770jWNeaG|Paris|The Chainsmokers|332122
7HE0d5NJ3twiJxh42oGF8m|Outta My Head|JEON SOMI|432111
6xsGllAEwkmF4SSDwdpmMt|Cold Water|Major Lazer, Justin Bieber, MØ|332111
0VpEX8ib3wE7u8NOw4szU6|Eyes Off You|PRETTYMUCH|342110
6f7BE3VcZScJx6n3wsf5Z3|I Like U|NIKI|233121
1r6qzxz77Tvbrvqd1Q1MIN|Collide (Sped Up)|Justine Skye, Tyga|322123
50oEtTUNlce4TuZXQoJzXW|urs|NIKI|113321
6PUtUVzOu0Wj6RvoJKini9|odds|NIKI|113331
4ROdFnoZNn2RTmwct0cVpx|Love Maze|BTS|332211
1dS4l6xmdgEhCZTAhdOm4N|Serendipity|BTS|224141
7ivYWXqrPLs66YwakDuSim|like i need u|keshi|222333
3iqlzKw1tLt6tXZyKWV0fZ|SOMEBODY|keshi|312323
68HocO7fx9z0MgDU0ZPHro|Every Summertime|NIKI|343020
5PtWJLo7A2G5ZROZJxLXSY|Trigger|Seori|312223
39uLYYZytVUwcjgeYLI409|Merry-Go-Round of Life|Joe Hisaishi|123141
3vWeZSOhhmOai0Go0zKm5j|she likes spring, I prefer winter|slchld|123231
1NCUe90ZCiWTnWn3umrwqw|Vintage|NIKI|122232
3uL1IBFhg52VcQqOwAG01E|Mast Magan|Arijit Singh, Chinmayi|134121
4MiZmaNIbvO7yY8UltCATD|vulnerable|Dhruv|102432
14gmLQPNYokqB8OKxAp69f|War With Heaven|keshi|211323
4NiehSBQthimPzRsVeOgCT|My My My!|Troye Sivan|442110
0Uon5NsSAkBDx69XYOaQ5P|Stay|Gracie Abrams|212432
6wBpO4Xc4YgShnENGSFA1M|Sour Grapes|LE SSERAFIM|322312
4sFGNz4MYpGoz53ZGCwsiE|i'm yours (sped up)|Isabel LaRosa|333122
5MsydV2Ii4A7r85gSgh90x|you deserve better|sadeyes|201432
5DKcc3WxMwE7JB1IxCrdrs|Scatterbrain|Emei|221331
6qL5UWxRSQYml9O99ozoLv|Love Songs|Kaash Paige|213333
5WbfFTuIldjL9x7W6y5l7R|Kingston|Faye Webster|222231
`;

export const SONGS: Song[] = RAW.trim()
  .split("\n")
  .map((line) => {
    const [id, title, artist, mood] = line.split("|");
    return { id, title, artist, mood: [...mood].map(Number) };
  });
