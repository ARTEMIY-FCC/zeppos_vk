import { gettext } from 'i18n'

AppSettingsPage({
  build(props) {
    return View(
      {
        style: {
          padding: '12px 20px'
        }
      },
      [
        TextInput({
          label: 'Как получить токен?',
          value: props.settingsStorage.getItem('docs') || "",
          value: 'https://github.com/ARTEMIY-FCC/zeppos_vk/',
          onChange: (val) => {
            props.settingsStorage.setItem('docs', val)
          }
        }),
        TextInput({
          label: 'Аккаунт 1',
          value: props.settingsStorage.getItem('token1') || "",
          onChange: (val) => {
            props.settingsStorage.setItem('token1', val)
          }
        }),
        TextInput({
          label: 'Аккаунт 2',
          value: props.settingsStorage.getItem('token2') || "",
          onChange: (val) => {
            props.settingsStorage.setItem('token2', val)
          }
        }),
        TextInput({
          label: 'Аккаунт 3',
          value: props.settingsStorage.getItem('token3') || "",
          onChange: (val) => {
            props.settingsStorage.setItem('token3', val)
          }
        })
      ]
    )
  }
})