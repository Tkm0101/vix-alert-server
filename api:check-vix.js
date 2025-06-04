export default async function handler(req, res) {
  try {
    // VIXデータを取得
    const vixResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX');
    const vixData = await vixResponse.json();
    
    // VIX価格を抽出
    const vixPrice = vixData.chart.result[0].meta.regularMarketPrice;
    console.log(`現在のVIX: ${vixPrice}`);
    
    // 環境変数から閾値を取得（デフォルト値設定）
    const upperThreshold = parseFloat(process.env.UPPER_THRESHOLD) || 30;
    const lowerThreshold = parseFloat(process.env.LOWER_THRESHOLD) || 15;
    
    console.log(`閾値 - 上限: ${upperThreshold}, 下限: ${lowerThreshold}`);
    
    // 閾値チェック
    let shouldSendNotification = false;
    let message = '';
    
    if (vixPrice >= upperThreshold) {
      shouldSendNotification = true;
      message = `🚨 VIX上限アラート！現在値: ${vixPrice.toFixed(2)} (閾値: ${upperThreshold})`;
    } else if (vixPrice <= lowerThreshold) {
      shouldSendNotification = true;
      message = `📉 VIX下限アラート！現在値: ${vixPrice.toFixed(2)} (閾値: ${lowerThreshold})`;
    }
    
    if (shouldSendNotification) {
      console.log('🔔 通知送信:', message);
      
      // プッシュ通知送信（後で実装）
      // 今はログ出力のみ
      
      res.status(200).json({
        success: true,
        alert: true,
        message: message,
        vixPrice: vixPrice
      });
    } else {
      console.log('✅ 正常範囲内');
      res.status(200).json({
        success: true,
        alert: false,
        message: `VIX正常範囲内: ${vixPrice.toFixed(2)}`,
        vixPrice: vixPrice
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}