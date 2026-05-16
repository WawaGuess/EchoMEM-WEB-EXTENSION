// 流式完成检测器接口（仅文档定义，无运行时代码）
//
// 所有策略工厂函数（params -> Detector 实例）需返回符合以下契约的对象：
//
// interface Detector {
//   /**
//    * 开始检测。底层若发现"流式已结束"，调用 onComplete()。
//    * onComplete 应当只触发一次：策略实现需在触发后自我停止或忽略后续状态。
//    * 若 start 时已处于 idle，应当同步或异步地立刻调用 onComplete。
//    */
//   start(onComplete: () => void): void;
//
//   /**
//    * 取消检测。释放所有定时器 / observer。
//    * 调用后再调 start 应当能重新启动。
//    */
//   stop(): void;
// }
//
// 策略实现应满足：
//   - 在内部维护超时 fallback（避免永久等待）；
//   - stop 必须是幂等的；
//   - 不应抛出（捕获后 console.warn）。
