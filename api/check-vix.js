// api/check-vix.js - 修正版
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // 環境変数の確認
  const upperThreshold = parseFloat(process.env.UPPER_THRESHOLD) || 30;
  const lowerThreshold = parseFloat(process.env.LOWER_THRESHOLD) || 10;
  const alertEmail = process.env.ALERT_EMAIL;

  console.log('🔧 Environment check:', {
    upperThreshold,
    lowerThreshold,
    alertEmail: alertEmail ? '✅ Set' : '❌ Missing',
    resendKey: process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'
  });

  // 必須環境変数のチェック
  if (!alertEmail || !process.env.RESEND_API_KEY) {
    console.error('❌ Missing required environment variables');
    return res.status(500).json({
      error: 'Missing required environment variables',
      details: {
        alertEmail: !!alertEmail,
        resendKey: !!process.env.RESEND_API_KEY
      }
    });
  }

  try {
    console.log('🚀 Starting VIX data fetch...');
    
    // Yahoo Finance APIからVIXデータを取得
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000 // 10秒タイムアウト
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Raw API response received');

    // データの検証
    if (!data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      console.error('❌ Invalid API response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid data structure from Yahoo Finance API');
    }

    const vixValue = data.chart.result[0].meta.regularMarketPrice;
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    console.log(`📈 Current VIX: ${vixValue} (Thresholds: ${lowerThreshold} - ${upperThreshold})`);

    // アラート条件の確認
    let shouldAlert = false;
    let alertType = '';
    let alertMessage = '';

    if (vixValue >= upperThreshold) {
      shouldAlert = true;
      alertType = 'HIGH';
      alertMessage = `VIX HIGH Alert: ${vixValue} (Threshold: ${upperThreshold}+) - Market fear index at high level.`;
    } else if (vixValue <= lowerThreshold) {
      shouldAlert = true;
      alertType = 'LOW';
      alertMessage = `VIX LOW Alert: ${vixValue} (Threshold: ${lowerThreshold}-) - Market fear index at low level.`;
    }

    console.log(`🔔 Alert needed: ${shouldAlert} (Type: ${alertType})`);

    // メール送信
    let emailResult = null;
    if (shouldAlert) {
      try {
        emailResult = await resend.emails.send({
          from: 'VIX Alert <onboarding@resend.dev>',
          to: [alertEmail],
          subject: `VIX ${alertType} Alert - ${vixValue}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${alertType === 'HIGH' ? '#dc3545' : '#28a745'};">
                VIX ${alertType === 'HIGH' ? 'HIGH' : 'LOW'} Alert
              </h2>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Current VIX Value:</strong> ${vixValue}</p>
                <p><strong>Threshold:</strong> ${alertType === 'HIGH' ? upperThreshold + '+' : lowerThreshold + '-'}</p>
                <p><strong>Detection Time:</strong> ${timestamp}</p>
              </div>
              <p>${alertMessage}</p>
              <hr>
              <p style="font-size: 12px; color: #666;">
                This alert was automatically sent by VIX Alert System.
              </p>
            </div>
          `
        });
        
        console.log('📧 Email sent successfully:', emailResult.data?.id);
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        // メール送信失敗でもAPIは成功レスポンスを返す
        emailResult = { error: emailError.message };
      }
    }

    // 成功レスポンス
    const response_data = {
      success: true,
      timestamp,
      vix: {
        value: vixValue,
        thresholds: {
          upper: upperThreshold,
          lower: lowerThreshold
        }
      },
      alert: {
        triggered: shouldAlert,
        type: alertType,
        message: alertMessage
      },
      email: emailResult
    };

    console.log('✅ Request completed successfully');
    return res.status(200).json(response_data);

  } catch (error) {
    console.error('❌ Fatal error in VIX check:', error);
    
    // 詳細なエラー情報をレスポンスに含める
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
