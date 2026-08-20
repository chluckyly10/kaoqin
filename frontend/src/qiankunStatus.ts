// 用于在qiankun沙箱中共享状态
// 由于qiankun的JS沙箱机制，window对象的设置不会在组件间共享
// 因此使用模块级变量来存储状态

let _isInQiankun = false;
let _qiankunProps: any = null;

export function setQiankunStatus(inQiankun: boolean, props?: any) {
  _isInQiankun = inQiankun;
  if (props) {
    _qiankunProps = props;
  }
}

export function getIsInQiankun(): boolean {
  return _isInQiankun;
}

export function getQiankunProps(): any {
  return _qiankunProps;
}
