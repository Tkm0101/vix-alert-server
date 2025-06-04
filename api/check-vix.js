export default async function handler(req, res) {
  try {
    console.log('🔄 VIXアラートチェック開始...');
    
    // VIXデータを取得
    const vixResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX');
    const vixData = await vixResponse.json();
    
    // VIX価格を抽出
    const vixPrice = vixData.chart.result[0].meta.regularMarketPrice;
    console.log(`📊 現在のVIX: ${vixPrice}`);
    
    // 環境変数から設定を取得
    const upperThreshold = parseFloat(process.env.UPPER_THRESHOLD) || 30;
    const lowerThreshold = parseFloat(process.env.LOWER_THRESHOLD) || 15;
    const resendApiKey = process.env.RESEND_API_KEY;
    const alertEmail = process.env.ALERT_EMAIL;
    
    console.log(`⚙️ 閾値設定 - 上限: ${upperThreshold}, 下限: ${lowerThreshold}`);
    
    // 閾値チェック
    let shouldSendAlert = false;
    let alertMessage = '';
    let alertSubject = '';
    
    if (vixPrice >= upperThreshold) {
      shouldSendAlert = true;
      alertSubject = '🚨 VIX上限アラート！';
      alertMessage = `VIX指数が上限閾値を超えました。
      
現在値: ${vixPrice.toFixed(2)}
上限閾値: ${upperThreshold}
      
市場の恐怖指数が高まっています。ポジションの確認をお勧めします。

時刻: ${new Date().toLocaleString('ja-JP')}`;
      
    } else if (vixPrice <= lowerThreshold) {
      shouldSendAlert = true;
      alertSubject = '📉 VIX下限アラート！';
      alertMessage = `VIX指数が下限閾値を下回りました。
      
現在値: ${vixPrice.toFixed(2)}
下限閾値: ${lowerThreshold}
      
市場が安定している可能性があります。

時刻: ${new Date().toLocaleString('ja-JP')}`;
    }
    
    if (shouldSendAlert && resendApiKey && alertEmail) {
      console.log('📧 メール通知を送信中...');
      
      // Resend APIでメール送信
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VIX Alert <onboarding@resend.dev>',
          to: [alertEmail],
          subject: alertSubject,
          text: alertMessage,
        }),
      });
      
      if (emailResponse.ok) {
        const emailResult = await emailResponse.json();
        console.log('✅ メール送信成功:', emailResult.id);
        
        res.status(200).json({
          success: true,
          alert: true,
          message: `アラート送信: ${alertSubject}`,
          vixPrice: vixPrice,
          emailSent: true,
          emailId: emailResult.id
        });
      } else {
        const errorData = await emailResponse.text();
        console.error('❌ メール送信失敗:', errorData);
        
        res.status(200).json({
          success: true,
          alert: true,
          message: `アラート発生（メール送信失敗）: ${alertSubject}`,
          vixPrice: vixPrice,
          emailSent: false,
          error: errorData
        });
      }
      
    } else if (shouldSendAlert) {
      console.log('⚠️ アラート発生but環境変数未設定');
      res.status(200).json({
        success: true,
        alert: true,
        message: `アラート発生: ${alertSubject}`,
        vixPrice: vixPrice,
        emailSent: false,
        error: 'メール設定が不完全'
      });
      
    } else {
      console.log('✅ VIX正常範囲内');
      res.status(200).json({
        success: true,
        alert: false,
        message: `VIX正常範囲内: ${vixPrice.toFixed(2)}`,
        vixPrice: vixPrice,
        emailSent: false
      });
    }
    
  } catch (error) {
    console.error('❌ エラー発生:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      emailSent: false
    });
  }
}
