module.exports = async (req, res) => {
    try {
      const url = `https://${process.env.METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_KEY}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(await r.json());
    } catch (_) {
      res.status(200).json([]);
    }
  };